from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.services.auth_service import (
    register_tenant,
    login_user,
    change_password,
    verify_email,
    resend_verification,
    request_password_reset,
    reset_password,
)
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    ResendVerificationRequest,
    MessageResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=201)
async def register(
    data: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    return await register_tenant(data, db)


@router.post("/login", response_model=TokenResponse)
async def login(
    data: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    return await login_user(data, db)


@router.post("/change-password", response_model=TokenResponse)
async def change_password_route(
    data: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await change_password(
        user=current_user,
        current_password=data.current_password,
        new_password=data.new_password,
        db=db,
    )


@router.get("/verify-email", response_model=MessageResponse)
async def verify_email_route(
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    return await verify_email(token, db)


@router.post("/resend-verification", response_model=MessageResponse)
async def resend_verification_route(
    data: ResendVerificationRequest,
    db: AsyncSession = Depends(get_db),
):
    return await resend_verification(data.email, db)


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password_route(
    data: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    return await request_password_reset(data.email, db)


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password_route(
    data: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    return await reset_password(data.token, data.new_password, db)


@router.post("/logout")
async def logout(
    current_user: User = Depends(get_current_user),
):
    return {"message": "Logged out successfully"}
