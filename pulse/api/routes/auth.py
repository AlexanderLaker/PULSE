"""Auth API routes — registration, login, profile, user management, password reset.

IMPORTANT: The app uses BaseHTTPMiddleware (LazyInitMiddleware) which requires
async def handlers. However, the auth functions call synchronous psycopg2 code
that blocks. Using asyncio.to_thread() bridges both requirements:
- Handlers stay async (compatible with BaseHTTPMiddleware)
- Blocking DB calls run in a separate thread (compatible with psycopg2)
"""

import asyncio
import logging
import traceback
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
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


@router.post("/auth/register")
async def register(req: RegisterRequest):
    """Register a new user account."""
    try:
        result = await asyncio.to_thread(register_user, req)
        return result.model_dump() if hasattr(result, 'model_dump') else result
    except HTTPException:
        raise
    except Exception as e:
        tb = traceback.format_exc()
        logger.error(f"Register error: {tb}")
        return JSONResponse(status_code=500, content={"detail": str(e), "traceback": tb})


@router.post("/auth/login")
async def login(req: LoginRequest):
    """Login and receive JWT token."""
    try:
        result = await asyncio.to_thread(login_user, req)
        return result.model_dump() if hasattr(result, 'model_dump') else result
    except HTTPException:
        raise
    except Exception as e:
        tb = traceback.format_exc()
        logger.error(f"Login error: {tb}")
        return JSONResponse(status_code=500, content={"detail": str(e), "traceback": tb})


@router.post("/auth/request-reset")
async def request_reset(req: RequestResetRequest):
    """Step 1: Send a password reset link to the user's email via Resend."""
    try:
        return await asyncio.to_thread(request_password_reset, req)
    except HTTPException:
        raise
    except Exception as e:
        tb = traceback.format_exc()
        logger.error(f"Request reset error: {tb}")
        return JSONResponse(status_code=500, content={"detail": str(e), "traceback": tb})


@router.post("/auth/confirm-reset")
async def confirm_reset(req: ConfirmResetRequest):
    """Step 2: Verify reset token and set new password."""
    try:
        return await asyncio.to_thread(confirm_password_reset, req)
    except HTTPException:
        raise
    except Exception as e:
        tb = traceback.format_exc()
        logger.error(f"Confirm reset error: {tb}")
        return JSONResponse(status_code=500, content={"detail": str(e), "traceback": tb})


@router.post("/auth/reset-password")
async def reset_pw(req: ResetPasswordRequest):
    """Legacy direct reset (backwards compat)."""
    try:
        return await asyncio.to_thread(reset_password, req)
    except HTTPException:
        raise
    except Exception as e:
        tb = traceback.format_exc()
        logger.error(f"Reset password error: {tb}")
        return JSONResponse(status_code=500, content={"detail": str(e), "traceback": tb})


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
    return await asyncio.to_thread(get_all_users)


@router.put("/auth/users/{user_id}", response_model=UserResponse)
async def update_user_route(user_id: str, req: UpdateProfileRequest, admin: dict = Depends(require_admin)):
    """Update a user's profile (admin only)."""
    return await asyncio.to_thread(update_user, user_id, req)


@router.delete("/auth/users/{user_id}")
async def delete_user_route(user_id: str, admin: dict = Depends(require_admin)):
    """Delete a user (admin only). Cannot delete yourself."""
    if admin.get("sub") == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    return await asyncio.to_thread(delete_user, user_id)
