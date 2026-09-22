"""Authentication of API requests.

Identity lives in Clerk. The Next.js side turns a Clerk session into a
short-lived HS256 token signed with ``PRISM_JWT_SECRET`` (lib/prismJwt.ts)
and hands it to this API in one of two ways:

- the ``prism-token`` cookie, set by /api/prism-cookie with role ``viewer``
  and scoped to /api/v1, which authorises the dashboard's reads;
- an ``Authorization: Bearer`` header, sent by the Next.js proxy routes that
  forward admin writes with the caller's real role.

This module only verifies tokens; it never issues them.
"""
import hashlib
import hmac
import json
import os
import time
from base64 import urlsafe_b64decode
from typing import Optional

from fastapi import Cookie, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

_bearer = HTTPBearer(auto_error=False)


def _jwt_secret() -> Optional[str]:
    """The signing secret, or None when it is missing or shorter than 32 characters."""
    secret = os.environ.get("PRISM_JWT_SECRET", "")
    return secret if len(secret) >= 32 else None


def _b64decode(s: str) -> bytes:
    return urlsafe_b64decode(s + "=" * (-len(s) % 4))


def verify_jwt(token: str) -> Optional[dict]:
    """The payload of a valid, unexpired HS256 token, else None.

    Without a usable secret every token is rejected rather than accepted.
    """
    secret = _jwt_secret()
    if secret is None:
        return None
    try:
        header_b64, payload_b64, sig_b64 = token.split(".")
        expected = hmac.new(secret.encode(), f"{header_b64}.{payload_b64}".encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(expected, _b64decode(sig_b64)):
            return None
        payload = json.loads(_b64decode(payload_b64))
    except (ValueError, TypeError):
        return None
    if not isinstance(payload, dict):
        return None
    exp = payload.get("exp")
    if isinstance(exp, bool) or not isinstance(exp, (int, float)) or exp < time.time():
        return None
    return payload


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    prism_token: Optional[str] = Cookie(None, alias="prism-token"),
) -> Optional[dict]:
    """The verified token payload; None when no token was sent, 401 when it is invalid.

    A Bearer header takes precedence over the cookie.
    """
    token = credentials.credentials if credentials else prism_token
    if not token:
        return None
    payload = verify_jwt(token)
    if payload is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token",
                            headers={"WWW-Authenticate": "Bearer"})
    return payload


def require_auth(user: Optional[dict] = Depends(get_current_user)) -> dict:
    """Any signed-in user."""
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication required",
                            headers={"WWW-Authenticate": "Bearer"})
    return user


def require_admin(user: dict = Depends(require_auth)) -> dict:
    """A signed-in user with the admin role."""
    if user.get("role") != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin access required")
    return user


def identity_from_user(user: Optional[dict]) -> tuple:
    """(user_id, display name, role) from a verified token payload.

    This is the only source of identity for the audit log and the expert
    proposals; nothing a client sends in a body or header is trusted for it.
    The id is the token's ``sub`` (else its email); the name is ``name`` or
    ``full_name``, else the email's local part; the role defaults to viewer.
    """
    user = user or {}
    email = user.get("email") or ""
    user_id = str(user.get("sub") or email or "anonymous")
    name = user.get("name") or user.get("full_name") or (email.split("@", 1)[0] if "@" in email else user_id)
    return user_id, str(name), str(user.get("role") or "viewer")
