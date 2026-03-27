"""Auth API routes — registration, login, profile, user management."""

import logging
from typing import Optional
from fastapi import APIRouter, Depends
from pulse.api.auth import (
    RegisterRequest, LoginRequest, UpdateProfileRequest,
    AuthResponse, UserResponse,
    register_user, login_user, get_all_users,
    get_current_user, require_auth, require_admin,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["auth"])


@router.post("/auth/register", response_model=AuthResponse)
async def register(req: RegisterRequest):
    """Register a new user account."""
    return register_user(req)


@router.post("/auth/login", response_model=AuthResponse)
async def login(req: LoginRequest):
    """Login and receive JWT token."""
    return login_user(req)


@router.get("/auth/me", response_model=Optional[UserResponse])
async def get_profile(user: Optional[dict] = Depends(get_current_user)):
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
async def list_users(user: dict = Depends(require_admin)):
    """List all users (admin only)."""
    return get_all_users()
