"""JWT verification for PRISM — verify-only module.

History: this module once contained a full custom auth system (register,
login, password reset, user CRUD). That system was superseded by Clerk
(see docs/CLERK_MIGRATION.md) and its HTTP routes were removed in the 2026-06
handover cleanup. What remains is the *verify side* of the auth bridge:

    Next.js (Clerk identity) ──▶ lib/prismJwt.ts mints a short-lived
    HS256 JWT signed with PRISM_JWT_SECRET ──▶ this module verifies it
    and enforces role-based access on the FastAPI engine endpoints.

Provides the FastAPI dependencies `get_current_user`, `require_auth`
and `require_admin` used by app.py and the analytics/delphi/scanner
routers.
"""

import hmac
import hashlib
import json
import logging
import os
import time
from base64 import urlsafe_b64decode
from typing import Optional

from fastapi import Cookie, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

logger = logging.getLogger(__name__)

# ── Configuration ────────────────────────────────────────────────
# PRISM_JWT_SECRET is required. Resolved lazily (on first auth-related
# request) rather than at import time so that a missing secret in the
# Vercel serverless environment doesn't crash create_app().
JWT_ALGORITHM = "HS256"


def _get_jwt_secret() -> str:
    """Resolve PRISM_JWT_SECRET lazily. Raise on demand, not on import."""
    secret = os.environ.get("PRISM_JWT_SECRET")
    if not secret:
        raise RuntimeError(
            "PRISM_JWT_SECRET environment variable is required. "
            "Generate one with: python -c 'import secrets; print(secrets.token_urlsafe(64))'"
        )
    if len(secret) < 32:
        raise RuntimeError(
            "PRISM_JWT_SECRET is too short — must be at least 32 characters."
        )
    return secret


security = HTTPBearer(auto_error=False)


# ── Minimal JWT verify (no PyJWT dependency) ─────────────────────
def _b64decode(s: str) -> bytes:
    padding = 4 - len(s) % 4
    if padding != 4:
        s += "=" * padding
    return urlsafe_b64decode(s)


def _verify_jwt(token: str, secret: Optional[str] = None) -> Optional[dict]:
    """Verify and decode a JWT token. Returns payload or None."""
    try:
        if secret is None:
            secret = _get_jwt_secret()
    except RuntimeError:
        # Secret missing — treat all tokens as invalid rather than crashing
        return None
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header_b64, payload_b64, sig_b64 = parts
        signing_input = f"{header_b64}.{payload_b64}"
        expected_sig = hmac.new(secret.encode(), signing_input.encode(), hashlib.sha256).digest()
        actual_sig = _b64decode(sig_b64)
        if not hmac.compare_digest(expected_sig, actual_sig):
            return None
        payload = json.loads(_b64decode(payload_b64))
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None


# ── FastAPI Dependencies ─────────────────────────────────────────
async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    pulse_token: Optional[str] = Cookie(None, alias="pulse-token"),
) -> Optional[dict]:
    """Extract current user from JWT.

    Accepts EITHER:
    - Authorization: Bearer <token> header (for API clients, curl, tests)
    - pulse-token httpOnly cookie (legacy web sessions)

    Returns None if neither is present. Raises 401 if token is invalid/expired.
    """
    token: Optional[str] = None
    if credentials:
        token = credentials.credentials
    elif pulse_token:
        token = pulse_token

    if not token:
        return None

    payload = _verify_jwt(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


async def require_auth(user: Optional[dict] = Depends(get_current_user)) -> dict:
    """Require authenticated user. Raises 401 if not authenticated."""
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


async def require_admin(user: dict = Depends(require_auth)) -> dict:
    """Require admin role."""
    if user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return user


def identity_from_user(user: Optional[dict]) -> tuple[str, str, str]:
    """Derive (user_id, user_name, user_role) from a verified JWT payload.

    M3 (July 2026 review): the single identity source for audit attribution
    and the multi-expert proposals layer — always derived from the VERIFIED
    token payload, never from client-supplied headers.

      user_id   — JWT `sub`, else `email` (one of these is always present in
                  a Clerk-minted token; falls back to "anonymous" defensively).
      user_name — best-effort display name: `name`/`full_name`, else the
                  email local-part, else the user_id.
      user_role — `role` claim if present, else "viewer".
    """
    user = user or {}
    email = user.get("email") or ""
    user_id = str(user.get("sub") or email or "anonymous")
    name = user.get("name") or user.get("full_name") or ""
    if not name:
        name = email.split("@", 1)[0] if "@" in email else user_id
    role = str(user.get("role") or "viewer")
    return user_id, str(name), role
