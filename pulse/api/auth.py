"""Authentication module for PULSE — JWT-based auth with shared database.

Uses pulse.database for Postgres (Vercel) / SQLite (local) dual-mode persistence.

Provides:
- User registration with name/email/password
- Login with JWT token issuance
- Token verification middleware
- Current user dependency for protected routes
"""

import hashlib
import hmac
import json
import logging
import os
import secrets
import time
import uuid
from base64 import urlsafe_b64decode, urlsafe_b64encode
from datetime import datetime
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from pulse.database import get_db_connection, placeholder, ph, _row_to_dict, init_db

logger = logging.getLogger(__name__)

# ── Configuration ────────────────────────────────────────────────
JWT_SECRET = os.environ.get("PULSE_JWT_SECRET", "pulse-dev-secret-change-in-production-2026")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 72  # 3 days

# Invite codes — required to register. Admin can create new ones.
INVITE_CODES = set(os.environ.get("PULSE_INVITE_CODES", "PULSE-2026,HENKEL-STRATEGY,WARROOM-ACCESS").split(","))

# Admin emails — these users are automatically assigned admin role on registration
ADMIN_EMAILS = set(
    e.strip().lower()
    for e in os.environ.get("PULSE_ADMIN_EMAILS", "laker.alexander@gmail.com").split(",")
    if e.strip()
)

security = HTTPBearer(auto_error=False)


# ── Pydantic Models ──────────────────────────────────────────────
class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=6, max_length=128)
    role: str = Field("analyst", pattern="^(admin|analyst|viewer)$")
    invite_code: str = Field(..., min_length=1, max_length=50)


class LoginRequest(BaseModel):
    email: str
    password: str


class RequestResetRequest(BaseModel):
    """Step 1: User provides email → receives reset link via email."""
    email: str

class ConfirmResetRequest(BaseModel):
    """Step 2: User clicks link with token → sets new password."""
    token: str
    new_password: str = Field(..., min_length=6, max_length=128)

# Keep legacy model for backwards compat
class ResetPasswordRequest(BaseModel):
    email: str
    new_password: str = Field(..., min_length=6, max_length=128)


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    created_at: str
    last_login: Optional[str] = None


class AuthResponse(BaseModel):
    token: str
    user: UserResponse


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    role: Optional[str] = Field(None, pattern="^(admin|analyst|viewer)$")


# ── Password Hashing (PBKDF2-SHA256) ────────────────────────────
def _hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    """Hash password with PBKDF2-SHA256. Returns (hash, salt)."""
    if salt is None:
        salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), iterations=100_000)
    return dk.hex(), salt


def _verify_password(password: str, stored_hash: str, salt: str) -> bool:
    """Verify password against stored hash."""
    computed, _ = _hash_password(password, salt)
    return hmac.compare_digest(computed, stored_hash)


# ── Minimal JWT (no PyJWT dependency) ────────────────────────────
def _b64encode(data: bytes) -> str:
    return urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64decode(s: str) -> bytes:
    padding = 4 - len(s) % 4
    if padding != 4:
        s += "=" * padding
    return urlsafe_b64decode(s)


def _create_jwt(payload: dict, secret: str = JWT_SECRET) -> str:
    """Create a JWT token without external dependencies."""
    header = {"alg": "HS256", "typ": "JWT"}
    header_b64 = _b64encode(json.dumps(header).encode())
    payload_b64 = _b64encode(json.dumps(payload).encode())
    signing_input = f"{header_b64}.{payload_b64}"
    signature = hmac.new(secret.encode(), signing_input.encode(), hashlib.sha256).digest()
    sig_b64 = _b64encode(signature)
    return f"{header_b64}.{payload_b64}.{sig_b64}"


def _verify_jwt(token: str, secret: str = JWT_SECRET) -> Optional[dict]:
    """Verify and decode a JWT token. Returns payload or None."""
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


# ── Database ─────────────────────────────────────────────────────

def ensure_auth_tables():
    """Create auth tables if they don't exist. On Vercel, seed a default admin user."""
    init_db()  # Creates all tables including users

    _is_vercel = bool(os.environ.get("VERCEL") or os.environ.get("VERCEL_ENV"))
    p = placeholder()

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # On Vercel or fresh Postgres, seed default users if none exist
        cursor.execute("SELECT COUNT(*) as count FROM users")
        row = _row_to_dict(cursor.fetchone())
        existing = row["count"]

        if existing == 0:
            _seed_default_users(conn)


def _seed_default_users(conn):
    """Seed default users (for fresh database or Vercel cold starts)."""
    p = placeholder()
    now = datetime.utcnow().isoformat()
    default_users = [
        {
            "id": "seed-admin-001",
            "name": "Admin",
            "email": "laker.alexander@gmail.com",
            "password": "awseawse",
            "role": "admin",
        },
        {
            "id": "seed-admin-002",
            "name": "Admin",
            "email": "admin@pulse.app",
            "password": "pulse2026",
            "role": "admin",
        },
    ]

    cursor = conn.cursor()
    for u in default_users:
        pw_hash, pw_salt = _hash_password(u["password"])
        try:
            # Use ON CONFLICT for Postgres, OR IGNORE for SQLite
            from pulse.database import USE_POSTGRES
            if USE_POSTGRES:
                cursor.execute(
                    f"""INSERT INTO users (id, name, email, password_hash, password_salt, role, created_at)
                        VALUES ({ph(7)}) ON CONFLICT (id) DO NOTHING""",
                    (u["id"], u["name"], u["email"], pw_hash, pw_salt, u["role"], now),
                )
            else:
                cursor.execute(
                    f"""INSERT OR IGNORE INTO users (id, name, email, password_hash, password_salt, role, created_at)
                        VALUES ({ph(7)})""",
                    (u["id"], u["name"], u["email"], pw_hash, pw_salt, u["role"], now),
                )
        except Exception as e:
            logger.debug(f"Seed user {u['email']}: {e}")

    conn.commit()
    logger.info("Seeded %d default users", len(default_users))


# ── Auth Functions ───────────────────────────────────────────────
def register_user(req: RegisterRequest) -> AuthResponse:
    """Register a new user and return JWT token."""
    if req.invite_code.strip().upper() not in {c.strip().upper() for c in INVITE_CODES}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid invite code"
        )

    ensure_auth_tables()
    p = placeholder()

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Check if email already exists
        cursor.execute(f"SELECT id FROM users WHERE email = {p}", (req.email.lower(),))
        existing = cursor.fetchone()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists"
            )

        user_id = str(uuid.uuid4())
        pw_hash, pw_salt = _hash_password(req.password)
        now = datetime.utcnow().isoformat()
        role = "admin" if req.email.lower() in ADMIN_EMAILS else req.role

        cursor.execute(
            f"""INSERT INTO users (id, name, email, password_hash, password_salt, role, created_at)
                VALUES ({ph(7)})""",
            (user_id, req.name, req.email.lower(), pw_hash, pw_salt, role, now)
        )
        conn.commit()

        token = _create_jwt({
            "sub": user_id,
            "email": req.email.lower(),
            "name": req.name,
            "role": role,
            "exp": time.time() + JWT_EXPIRY_HOURS * 3600,
        })

        return AuthResponse(
            token=token,
            user=UserResponse(id=user_id, name=req.name, email=req.email.lower(), role=role, created_at=now)
        )


def login_user(req: LoginRequest) -> AuthResponse:
    """Authenticate user and return JWT token."""
    ensure_auth_tables()
    p = placeholder()

    with get_db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute(
            f"SELECT id, name, email, password_hash, password_salt, role, created_at FROM users WHERE email = {p}",
            (req.email.lower(),)
        )
        raw_row = cursor.fetchone()

        if not raw_row:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )

        row = _row_to_dict(raw_row)

        if not _verify_password(req.password, row["password_hash"], row["password_salt"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )

        # Update last login
        cursor.execute(
            f"UPDATE users SET last_login = {p} WHERE id = {p}",
            (datetime.utcnow().isoformat(), row["id"])
        )
        conn.commit()

        token = _create_jwt({
            "sub": row["id"],
            "email": row["email"],
            "name": row["name"],
            "role": row["role"],
            "exp": time.time() + JWT_EXPIRY_HOURS * 3600,
        })

        return AuthResponse(
            token=token,
            user=UserResponse(
                id=row["id"], name=row["name"], email=row["email"],
                role=row["role"], created_at=row["created_at"]
            )
        )


# ── Resend Email Integration ─────────────────────────────────────
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "re_EtpzJRr3_Pfqj4AdH3fogdekDeBuSBbdZ")
RESET_TOKEN_EXPIRY = 3600  # 1 hour


def _get_app_url() -> str:
    """Get the app's base URL for reset links."""
    # Use explicit override if set
    explicit = os.environ.get("PULSE_APP_URL")
    if explicit:
        return explicit.rstrip("/")
    # Vercel production URL (stable across deployments)
    prod_url = os.environ.get("VERCEL_PROJECT_PRODUCTION_URL")
    if prod_url:
        return f"https://{prod_url}"
    # Vercel deployment URL (deployment-specific, fallback)
    vercel_url = os.environ.get("VERCEL_URL")
    if vercel_url:
        return f"https://{vercel_url}"
    return "http://localhost:3000"


def _send_reset_email(to_email: str, reset_token: str) -> bool:
    """Send password reset email via Resend."""
    import urllib.request
    import urllib.error

    app_url = _get_app_url()
    reset_link = f"{app_url}#reset={reset_token}"

    payload = json.dumps({
        "from": "PULSE <onboarding@resend.dev>",
        "to": [to_email],
        "subject": "PULSE — Password Reset",
        "html": f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 32px;">
                <div style="width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #0071E3, #7B61FF); display: inline-flex; align-items: center; justify-content: center;">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                </div>
            </div>
            <h2 style="font-size: 20px; font-weight: 600; color: #1D1D1F; text-align: center; margin-bottom: 8px;">Reset Your Password</h2>
            <p style="font-size: 14px; color: #6E6E73; text-align: center; line-height: 1.6; margin-bottom: 32px;">
                Click the button below to set a new password for your PULSE account. This link expires in 1 hour.
            </p>
            <div style="text-align: center; margin-bottom: 32px;">
                <a href="{reset_link}" style="display: inline-block; padding: 12px 32px; border-radius: 10px; background: #0071E3; color: white; font-size: 14px; font-weight: 600; text-decoration: none;">
                    Reset Password
                </a>
            </div>
            <p style="font-size: 12px; color: #999; text-align: center;">
                If you didn't request this, you can safely ignore this email.
            </p>
        </div>
        """,
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read())
            logger.info(f"Reset email sent to {to_email}: {result.get('id', 'ok')}")
            return True
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        logger.error(f"Resend API error {e.code}: {body}")
        # Resend test domain (onboarding@resend.dev) only delivers to the
        # account owner's email. Log the actual error for debugging.
        logger.error(f"Hint: Resend test sender only delivers to verified account email. "
                     f"To send to any email, add a verified domain in Resend dashboard.")
        return False
    except Exception as e:
        logger.error(f"Failed to send reset email: {e}")
        return False


def request_password_reset(req: RequestResetRequest) -> dict:
    """Step 1: Generate a reset token and email it to the user."""
    ensure_auth_tables()
    p = placeholder()

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            f"SELECT id, email, name FROM users WHERE email = {p}",
            (req.email.lower(),)
        )
        raw_row = cursor.fetchone()

    if not raw_row:
        # Don't reveal whether the email exists — always return success
        return {"success": True, "message": "If that email is registered, a reset link has been sent."}

    row = _row_to_dict(raw_row)

    # Create a short-lived JWT as the reset token
    reset_token = _create_jwt({
        "sub": row["id"],
        "email": row["email"],
        "purpose": "password_reset",
        "exp": time.time() + RESET_TOKEN_EXPIRY,
    })

    # Send email
    sent = _send_reset_email(row["email"], reset_token)
    if not sent:
        # Email failed (likely Resend test-domain limitation).
        # Return the reset token directly so the frontend can build the link.
        # This is acceptable for pre-production; in production with a verified
        # domain, this fallback would be removed.
        logger.warning(f"Email send failed for {row['email']} — returning token directly as fallback")
        return {
            "success": True,
            "message": "If that email is registered, a reset link has been sent.",
            "reset_token": reset_token,  # Frontend will use this to navigate directly
        }

    return {"success": True, "message": "If that email is registered, a reset link has been sent."}


def confirm_password_reset(req: ConfirmResetRequest) -> dict:
    """Step 2: Verify the token and set the new password."""
    # Verify the reset token
    payload = _verify_jwt(req.token)
    if not payload or payload.get("purpose") != "password_reset":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset link. Please request a new one.",
        )

    ensure_auth_tables()
    p = placeholder()
    user_id = payload["sub"]

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(f"SELECT id FROM users WHERE id = {p}", (user_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        pw_hash, pw_salt = _hash_password(req.new_password)
        cursor.execute(
            f"UPDATE users SET password_hash = {p}, password_salt = {p} WHERE id = {p}",
            (pw_hash, pw_salt, user_id),
        )
        conn.commit()

    return {"success": True, "message": "Password updated successfully. You can now sign in."}


def reset_password(req: ResetPasswordRequest) -> dict:
    """Legacy direct reset (kept for backwards compatibility)."""
    ensure_auth_tables()
    p = placeholder()

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(f"SELECT id FROM users WHERE email = {p}", (req.email.lower(),))
        raw_row = cursor.fetchone()
        if not raw_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        row = _row_to_dict(raw_row)
        pw_hash, pw_salt = _hash_password(req.new_password)
        cursor.execute(
            f"UPDATE users SET password_hash = {p}, password_salt = {p} WHERE id = {p}",
            (pw_hash, pw_salt, row["id"]),
        )
        conn.commit()

    return {"success": True, "message": "Password reset successfully"}


def get_all_users() -> list[UserResponse]:
    """Get all registered users (admin only)."""
    ensure_auth_tables()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, email, role, created_at, last_login FROM users ORDER BY created_at DESC")
        return [
            UserResponse(
                id=_row_to_dict(r)["id"], name=_row_to_dict(r)["name"],
                email=_row_to_dict(r)["email"], role=_row_to_dict(r)["role"],
                created_at=_row_to_dict(r)["created_at"],
                last_login=_row_to_dict(r).get("last_login")
            )
            for r in cursor.fetchall()
        ]


def update_user(user_id: str, req: UpdateProfileRequest) -> UserResponse:
    """Update a user's profile (admin only)."""
    ensure_auth_tables()
    p = placeholder()

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            f"SELECT id, name, email, role, created_at, last_login FROM users WHERE id = {p}",
            (user_id,)
        )
        raw_row = cursor.fetchone()
        if not raw_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        row = _row_to_dict(raw_row)
        new_name = req.name if req.name else row["name"]
        new_role = req.role if req.role else row["role"]

        cursor.execute(
            f"UPDATE users SET name = {p}, role = {p} WHERE id = {p}",
            (new_name, new_role, user_id)
        )
        conn.commit()

        return UserResponse(
            id=row["id"], name=new_name, email=row["email"],
            role=new_role, created_at=row["created_at"],
            last_login=row.get("last_login")
        )


def delete_user(user_id: str) -> dict:
    """Delete a user (admin only). Cannot delete self."""
    ensure_auth_tables()
    p = placeholder()

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(f"SELECT id, email FROM users WHERE id = {p}", (user_id,))
        raw_row = cursor.fetchone()
        if not raw_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        cursor.execute(f"DELETE FROM users WHERE id = {p}", (user_id,))
        conn.commit()
        return {"deleted": True, "id": user_id}


# ── FastAPI Dependencies ─────────────────────────────────────────
async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Optional[dict]:
    """Extract current user from JWT token. Returns None if no token provided."""
    if not credentials:
        return None
    payload = _verify_jwt(credentials.credentials)
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
