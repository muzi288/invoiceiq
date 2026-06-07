from fastapi import APIRouter, Depends, Request, UploadFile, File, Form, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import uuid
import csv
import io
from datetime import datetime

from app.core.database import get_db
from app.core.dependencies import (
    get_current_user,
    get_current_approver,
    get_current_owner,
    get_current_exporter,
)
from app.models.user import User
from app.services import invoice_service
from app.schemas.invoice import (
    InvoiceResponse,
    InvoiceListResponse,
    ApproveRejectRequest,
)
from app.schemas.extracted_data import (
    ExtractedDataUpdate,
    InvoiceWithDataResponse,
)

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


@router.get("/export")
async def export_invoices(
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_exporter),
):
    result = await invoice_service.get_invoices(
        tenant_id=current_user.tenant_id,
        current_user=current_user,
        db=db,
        limit=10000,
        status_filter="approved",
        category=category,
        date_from=date_from,
        date_to=date_to,
    )

    invoices = result["items"]

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "Invoice ID", "Vendor", "Invoice Number", "Date",
        "Due Date", "Total", "Currency", "Category",
        "Uploaded By", "Upload Date", "Payment Status"
    ])

    for inv in invoices:
        ed = getattr(inv, "extracted_data", None)
        writer.writerow([
            str(inv.id),
            ed.vendor_name if ed else "",
            ed.invoice_number if ed else "",
            ed.invoice_date if ed else "",
            ed.due_date if ed else "",
            ed.total_amount if ed else "",
            ed.currency if ed else "",
            inv.category,
            str(inv.uploaded_by),
            inv.upload_date.strftime("%Y-%m-%d"),
            inv.payment_status,
        ])

    output.seek(0)
    filename = f"invoices_{datetime.now().strftime('%Y%m%d')}.csv"

    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
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
