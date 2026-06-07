from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_owner
from app.models.tenant_settings import TenantSettings
from app.models.user import User
from app.schemas.tenant import TenantSettingsResponse, TenantSettingsUpdate

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=TenantSettingsResponse)
async def get_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(TenantSettings).where(
            TenantSettings.tenant_id == current_user.tenant_id
        )
    )
    settings = result.scalar_one_or_none()

    if not settings:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Settings not found"
        )

    return settings


@router.patch("", response_model=TenantSettingsResponse)
async def update_settings(
    data: TenantSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_owner),
):
    result = await db.execute(
        select(TenantSettings).where(
            TenantSettings.tenant_id == current_user.tenant_id
        )
    )
    settings = result.scalar_one_or_none()

    if not settings:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Settings not found"
        )

    updates = data.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(settings, field, value)

    return settings
