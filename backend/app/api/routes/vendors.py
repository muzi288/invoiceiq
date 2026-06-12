import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.services import vendor_service
from app.schemas.vendor import VendorListResponse, VendorDetailResponse

router = APIRouter(prefix="/vendors", tags=["vendors"])


@router.get("", response_model=VendorListResponse)
async def list_vendors(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await vendor_service.get_vendors(
        tenant_id=current_user.tenant_id,
        db=db,
    )


@router.get("/{vendor_id}", response_model=VendorDetailResponse)
async def get_vendor(
    vendor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await vendor_service.get_vendor_detail(
        vendor_id=vendor_id,
        tenant_id=current_user.tenant_id,
        db=db,
    )
