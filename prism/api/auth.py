"""Authentication of API requests.

Identity lives in Clerk. The Next.js side turns a Clerk session into an
HS256 token signed with ``PRISM_JWT_SECRET`` (lib/prismJwt.ts) and hands it
to this API in one of two ways:

- the ``prism-token`` cookie, set by /api/prism-cookie with role ``viewer``,
  valid for thirty minutes and scoped to /api/v1, which authorises the
  dashboard's reads and the user's own expert proposals;
- an ``Authorization: Bearer`` header with a five-minute token, sent by the
  Next.js proxy routes that forward admin writes with the caller's real role.

A valid token is not enough on its own: on PostgreSQL, where the dashboard
keeps its ``user_roles`` table, every authenticated request also looks the
token's ``sub`` up there (prism.database.load_user_role), so a role taken
away ends the user's reads at their next request rather than when the cookie
runs out. A user without a row is refused with the code ``no_role``; a token
that claims admin for a user whose stored role is viewer with ``not_admin``.
The stored role never upgrades a token: a viewer cookie stays a viewer, for
an admin too. On SQLite (development and the test suite) there is no role
table, so the check is skipped (CHECK_STORED_ROLE). This module only
verifies tokens; it never issues them.
"""
import hashlib
import hmac
import json
import os
import time
from base64 import urlsafe_b64decode

from fastapi import Cookie, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from prism import database
from prism.numbers import finite_number

_bearer = HTTPBearer(auto_error=False)
#: The shortest PRISM_JWT_SECRET accepted; the dashboard signs with no shorter
#: one (lib/prismJwt.ts MIN_SECRET_LENGTH).
MIN_SECRET_LENGTH = 32
#: Whether require_auth checks the token's role against the stored one: on
#: PostgreSQL, which holds the dashboard's user_roles table, and on Vercel
#: whatever the database setting (a deployment without a database URL is a
#: misconfiguration, and the lookup then answers 503 rather than letting a
#: token through unchecked); not on SQLite, which never holds the table.
#: Tests set it to exercise both paths.
CHECK_STORED_ROLE = database.USE_POSTGRES or database.on_vercel()
ADMIN = "admin"


class RoleRefused(Exception):
    """A 403 whose body names the refusal: FastAPI's ``detail`` plus a ``code``
    the dashboard reads (lib/apiClient.ts): ``no_role`` when the user has no
    stored role, ``not_admin`` when an admin role is claimed or required and
    the user does not hold it."""

    status_code = status.HTTP_403_FORBIDDEN

    def __init__(self, detail: str, code: str):
        self.detail, self.code = detail, code
        super().__init__(detail)


#: The two refusals: (detail, code).
NO_ROLE = ("Your access to PRISM has been removed or not yet granted.", "no_role")
NOT_ADMIN = ("Admin access is required.", "not_admin")


def _jwt_secret() -> str | None:
    """The signing secret, or None when it is missing or shorter than MIN_SECRET_LENGTH."""
    secret = os.environ.get("PRISM_JWT_SECRET", "")
    return secret if len(secret) >= MIN_SECRET_LENGTH else None


def _b64decode(s: str) -> bytes:
    return urlsafe_b64decode(s + "=" * (-len(s) % 4))


def verify_jwt(token: str) -> dict | None:
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
    if not finite_number(exp) or exp < time.time():
        return None
    return payload


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    prism_token: str | None = Cookie(None, alias="prism-token"),
) -> dict | None:
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


def check_stored_role(user: dict) -> None:
    """RoleRefused unless the user's stored role still covers the token's.

    The lookup is by the token's ``sub``; a token without one is refused
    without a lookup, as a user without a row is. No row: ``no_role``. A row
    with viewer while the token claims admin: ``not_admin``. A row with admin
    while the token is a viewer cookie: the token stays a viewer. A database
    out of reach raises DatabaseUnavailableError, answered 503 as for the data
    routes.
    """
    sub = user.get("sub")
    stored = database.load_user_role(str(sub)) if sub else None
    if stored is None:
        raise RoleRefused(*NO_ROLE)
    if user.get("role") == ADMIN and stored != ADMIN:
        raise RoleRefused(*NOT_ADMIN)


def require_auth(user: dict | None = Depends(get_current_user)) -> dict:
    """A user with a valid token, viewer or admin, whose stored role still
    covers the token's where the role table exists (CHECK_STORED_ROLE)."""
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication required",
                            headers={"WWW-Authenticate": "Bearer"})
    if CHECK_STORED_ROLE:
        check_stored_role(user)
    return user


def require_admin(user: dict = Depends(require_auth)) -> dict:
    """A signed-in user with the admin role."""
    if user.get("role") != ADMIN:
        raise RoleRefused(*NOT_ADMIN)
    return user


def identity_from_user(user: dict | None) -> tuple:
    """(user_id, display name, role) from a verified token payload.

    This is the only source of identity for the audit log and the expert
    proposals; nothing a client sends in a body or header is trusted for it.
    The id is the token's ``sub`` (else its email); the name is its ``name``
    (the user's full name in Clerk), else the email's local part; the role
    defaults to viewer.
    """
    user = user or {}
    email = user.get("email") or ""
    user_id = str(user.get("sub") or email or "anonymous")
    name = user.get("name") or (email.split("@", 1)[0] if "@" in email else user_id)
    return user_id, str(name), str(user.get("role") or "viewer")
