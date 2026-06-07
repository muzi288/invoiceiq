import uuid
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.dependencies import get_current_owner, get_current_user
from app.core.security import hash_password
from app.models.user import User
from app.services.audit_service import log_action
from app.schemas.user import (
    InviteUserRequest,
    UpdatePermissionsRequest,
    UserResponse,
)

router = APIRouter(prefix="/users", tags=["users"])


@router.post("/invite", response_model=UserResponse, status_code=201)
async def invite_user(
    request: Request,
    data: InviteUserRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_owner),
):
    existing = await db.execute(
        select(User).where(User.email == data.email)
    )
    if existing.scalar_one_or_none():
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    new_user = User(
        id=uuid.uuid4(),
        tenant_id=current_user.tenant_id,
        email=data.email,
        hashed_password=hash_password("ChangeMe123!"),
        full_name=data.full_name,
        role=data.role,
        can_approve=False,
        can_export=False,
        email_verified=False,
    )
    db.add(new_user)
    await db.flush()

    await log_action(
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        action="user_created",
        extra_data={
            "new_user_id": str(new_user.id),
            "email": data.email,
            "role": data.role,
        },
        ip_address=request.client.host if request.client else None,
    )

    return new_user


@router.patch("/{user_id}/permissions", response_model=UserResponse)
async def update_permissions(
    user_id: uuid.UUID,
    data: UpdatePermissionsRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_owner),
):
    from fastapi import HTTPException, status
    result = await db.execute(
        select(User).where(
            User.id == user_id,
            User.tenant_id == current_user.tenant_id,
        )
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if user.role == "owner":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify owner permissions"
        )

    changes = {}
    if data.can_approve is not None:
        changes["can_approve"] = {
            "old": user.can_approve,
            "new": data.can_approve
        }
        user.can_approve = data.can_approve

    if data.can_export is not None:
        changes["can_export"] = {
            "old": user.can_export,
            "new": data.can_export
        }
        user.can_export = data.can_export

    await log_action(
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        action="permission_granted",
        extra_data={
            "target_user_id": str(user_id),
            "changes": changes,
        },
        ip_address=request.client.host if request.client else None,
    )

    return user


@router.delete("/{user_id}", status_code=204)
async def deactivate_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_owner),
):
    from fastapi import HTTPException, status
    result = await db.execute(
        select(User).where(
            User.id == user_id,
            User.tenant_id == current_user.tenant_id,
        )
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if user.role == "owner":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate owner account"
        )

    user.is_active = False


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
):
    return current_user
