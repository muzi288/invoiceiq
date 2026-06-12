from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.services.auth_service import register_tenant, login_user, change_password
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, ChangePasswordRequest

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


@router.post("/logout")
async def logout(
    current_user: User = Depends(get_current_user),
):
    # JWT is stateless — token is discarded on the frontend
    # Production would blacklist the token in Redis
    return {"message": "Logged out successfully"}
