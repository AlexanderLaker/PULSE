"""Auth API routes — registration, login, profile, user management, password reset.

IMPORTANT: All route handlers that call synchronous database code (psycopg2) MUST
use plain `def` (not `async def`). FastAPI runs plain `def` handlers in a thread pool,
which avoids event-loop conflicts with psycopg2's blocking I/O on Vercel's serverless
Python runtime. Using `async def` with blocking DB calls causes
"RuntimeError: This event loop is already running" on Vercel/Neon.
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pulse.api.auth import (
    RegisterRequest, LoginRequest, UpdateProfileRequest,
    RequestResetRequest, ConfirmResetRequest, ResetPasswordRequest,
    AuthResponse, UserResponse,
    register_user, login_user, get_all_users, update_user, delete_user,
    request_password_reset, confirm_password_reset, reset_password,
    get_current_user, require_auth, require_admin,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["auth"])


@router.post("/auth/register", response_model=AuthResponse)
def register(req: RegisterRequest):
    """Register a new user account."""
    return register_user(req)


@router.post("/auth/login", response_model=AuthResponse)
def login(req: LoginRequest):
    """Login and receive JWT token."""
    return login_user(req)


@router.post("/auth/request-reset")
def request_reset(req: RequestResetRequest):
    """Step 1: Send a password reset link to the user's email via Resend."""
    return request_password_reset(req)


@router.post("/auth/confirm-reset")
def confirm_reset(req: ConfirmResetRequest):
    """Step 2: Verify reset token and set new password."""
    return confirm_password_reset(req)


@router.post("/auth/reset-password")
def reset_pw(req: ResetPasswordRequest):
    """Legacy direct reset (backwards compat)."""
    return reset_password(req)


@router.get("/auth/me", response_model=Optional[UserResponse])
def get_profile(user: Optional[dict] = Depends(get_current_user)):
    """Get current user profile. Returns null if not authenticated."""
    if not user:
        return None
    return UserResponse(
        id=user["sub"],
        name=user["name"],
        email=user["email"],
        role=user["role"],
        created_at="",
    )


@router.get("/auth/users", response_model=list[UserResponse])
def list_users(user: dict = Depends(require_admin)):
    """List all users (admin only)."""
    return get_all_users()


@router.put("/auth/users/{user_id}", response_model=UserResponse)
def update_user_route(user_id: str, req: UpdateProfileRequest, admin: dict = Depends(require_admin)):
    """Update a user's profile (admin only)."""
    return update_user(user_id, req)


@router.delete("/auth/users/{user_id}")
def delete_user_route(user_id: str, admin: dict = Depends(require_admin)):
    """Delete a user (admin only). Cannot delete yourself."""
    if admin.get("sub") == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    return delete_user(user_id)
