from fastapi import APIRouter, Depends, Request, UploadFile, File, Form, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import uuid

from app.core.database import get_db
from app.core.dependencies import (
    get_current_user,
    get_current_approver,
    get_current_owner,
)
from app.models.user import User
from app.services import invoice_service
from app.schemas.invoice import (
    InvoiceListResponse,
    ApproveRejectRequest,
)
from app.schemas.extracted_data import ExtractedDataUpdate

router = APIRouter(prefix="/invoices", tags=["invoices"])


@router.post("/upload", status_code=202)
async def upload_invoice(
    request: Request,
    file: UploadFile = File(...),
    category: str = Form(default="uncategorised"),
    tags: str = Form(default=""),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tag_list = [t.strip() for t in tags.split(",") if t.strip()]
    ip = request.client.host if request.client else None

    return await invoice_service.upload_invoice(
        file=file,
        category=category,
        tags=tag_list,
        current_user=current_user,
        db=db,
        ip_address=ip,
    )


@router.get("", response_model=InvoiceListResponse)
async def get_invoices(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    status: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await invoice_service.get_invoices(
        tenant_id=current_user.tenant_id,
        current_user=current_user,
        db=db,
        page=page,
        limit=limit,
        status_filter=status,
        category=category,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/{invoice_id}/file")
async def get_invoice_file(
    invoice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contents, content_type = await invoice_service.get_invoice_file(
        invoice_id=invoice_id,
        current_user=current_user,
        db=db,
    )
    return Response(
        content=contents,
        media_type=content_type,
        headers={"Cache-Control": "private, max-age=3600"},
    )


@router.get("/{invoice_id}")
async def get_invoice(
    invoice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await invoice_service.get_invoice(
        invoice_id=invoice_id,
        current_user=current_user,
        db=db,
    )


@router.patch("/{invoice_id}/approve")
async def approve_invoice(
    invoice_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_approver),
):
    ip = request.client.host if request.client else None
    return await invoice_service.approve_invoice(
        invoice_id=invoice_id,
        current_user=current_user,
        db=db,
        ip_address=ip,
    )


@router.patch("/{invoice_id}/reject")
async def reject_invoice(
    invoice_id: uuid.UUID,
    request: Request,
    data: ApproveRejectRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_approver),
):
    ip = request.client.host if request.client else None
    return await invoice_service.reject_invoice(
        invoice_id=invoice_id,
        reason=data.reason,
        current_user=current_user,
        db=db,
        ip_address=ip,
    )


@router.patch("/{invoice_id}/extracted")
async def update_extracted(
    invoice_id: uuid.UUID,
    request: Request,
    data: ExtractedDataUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ip = request.client.host if request.client else None
    updates = data.model_dump(exclude_unset=True)
    return await invoice_service.update_extracted_data(
        invoice_id=invoice_id,
        updates=updates,
        current_user=current_user,
        db=db,
        ip_address=ip,
    )


@router.delete("/{invoice_id}", status_code=204)
async def delete_invoice(
    invoice_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_owner),
):
    ip = request.client.host if request.client else None
    await invoice_service.delete_invoice(
        invoice_id=invoice_id,
        current_user=current_user,
        db=db,
        ip_address=ip,
    )
