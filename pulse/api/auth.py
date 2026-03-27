"""Authentication module for PULSE — JWT-based auth with SQLite user store.

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
import sqlite3
import time
import uuid
from base64 import urlsafe_b64decode, urlsafe_b64encode
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# ── Configuration ────────────────────────────────────────────────
JWT_SECRET = os.environ.get("PULSE_JWT_SECRET", "pulse-dev-secret-change-in-production-" + secrets.token_hex(8))
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 72  # 3 days
DB_PATH = os.environ.get("PULSE_AUTH_DB", str(Path(__file__).resolve().parent.parent.parent / "data" / "auth.db"))

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
        # Check expiry
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None


# ── Database ─────────────────────────────────────────────────────
def _get_db() -> sqlite3.Connection:
    """Get SQLite connection for auth database."""
    db_dir = Path(DB_PATH).parent
    db_dir.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def ensure_auth_tables():
    """Create auth tables if they don't exist."""
    conn = _get_db()
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                password_salt TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'analyst',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")
        conn.commit()
    finally:
        conn.close()


# ── Auth Functions ───────────────────────────────────────────────
def register_user(req: RegisterRequest) -> AuthResponse:
    """Register a new user and return JWT token."""
    # Validate invite code
    if req.invite_code.strip().upper() not in {c.strip().upper() for c in INVITE_CODES}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid invite code"
        )
    ensure_auth_tables()
    conn = _get_db()
    try:
        # Check if email already exists
        existing = conn.execute("SELECT id FROM users WHERE email = ?", (req.email.lower(),)).fetchone()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists"
            )

        user_id = str(uuid.uuid4())
        pw_hash, pw_salt = _hash_password(req.password)
        now = datetime.utcnow().isoformat()

        # Auto-promote admin emails
        role = "admin" if req.email.lower() in ADMIN_EMAILS else req.role

        conn.execute(
            "INSERT INTO users (id, name, email, password_hash, password_salt, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (user_id, req.name, req.email.lower(), pw_hash, pw_salt, role, now)
        )
        conn.commit()

        # Issue JWT
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
    finally:
        conn.close()


def login_user(req: LoginRequest) -> AuthResponse:
    """Authenticate user and return JWT token."""
    ensure_auth_tables()
    conn = _get_db()
    try:
        row = conn.execute(
            "SELECT id, name, email, password_hash, password_salt, role, created_at FROM users WHERE email = ?",
            (req.email.lower(),)
        ).fetchone()

        if not row:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )

        if not _verify_password(req.password, row["password_hash"], row["password_salt"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )

        # Update last login
        conn.execute("UPDATE users SET last_login = ? WHERE id = ?", (datetime.utcnow().isoformat(), row["id"]))
        conn.commit()

        # Issue JWT
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
    finally:
        conn.close()


def get_all_users() -> list[UserResponse]:
    """Get all registered users (admin only)."""
    ensure_auth_tables()
    conn = _get_db()
    try:
        rows = conn.execute("SELECT id, name, email, role, created_at, last_login FROM users ORDER BY created_at DESC").fetchall()
        return [UserResponse(id=r["id"], name=r["name"], email=r["email"], role=r["role"], created_at=r["created_at"], last_login=r["last_login"]) for r in rows]
    finally:
        conn.close()


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
