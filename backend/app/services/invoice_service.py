import uuid
import math
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from fastapi import HTTPException, status, UploadFile

from app.models.invoice import Invoice
from app.models.extracted_data import ExtractedData
from app.models.line_item import LineItem
from app.models.user import User
from app.services.audit_service import log_action
from app.services.storage_service import upload_file, generate_signed_url


async def upload_invoice(
    file: UploadFile,
    category: str,
    tags: list[str],
    current_user: User,
    db: AsyncSession,
    ip_address: str | None = None,
) -> dict:
    """
    Handle invoice upload.
    Sequence: validate → hash → dedup check → upload to blob
              → create invoice row → audit log → trigger extraction
    """

    # Step 1 — read file into memory
    file_contents = await file.read()

    # Step 2 — validate file type and size
    # Map content type to our short file_type
    content_type_map = {
        "application/pdf": "pdf",
        "image/jpeg":      "jpeg",
        "image/jpg":       "jpeg",
        "image/png":       "png",
    }
    file_type = content_type_map.get(file.content_type)
    if not file_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Allowed: PDF, JPEG, PNG"
        )

    # Step 3 — upload to blob (validates size internally, returns hash)
    # upload_file hashes the file and validates size before uploading
    file_path, file_hash, file_size = await upload_file(
        contents=file_contents,
        content_type=file.content_type,
        tenant_id=current_user.tenant_id,
    )

    # Step 4 — duplicate detection
    existing = await db.execute(
        select(Invoice).where(
            and_(
                Invoice.tenant_id == current_user.tenant_id,
                Invoice.file_hash == file_hash,
                Invoice.deleted_at == None,
            )
        )
    )
    duplicate = existing.scalar_one_or_none()
    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Duplicate invoice detected. "
                   f"This file was already uploaded on "
                   f"{duplicate.upload_date.strftime('%d %b %Y')}."
        )

    # Step 5 — create invoice row
    invoice = Invoice(
        id=uuid.uuid4(),
        tenant_id=current_user.tenant_id,
        uploaded_by=current_user.id,
        file_path=file_path,
        file_type=file_type,
        file_size_bytes=file_size,
        file_hash=file_hash,
        category=category,
        tags=tags,
        status="pending_review",
        extraction_status="pending",
    )
    db.add(invoice)
    await db.flush()  # get invoice.id before audit log

    # Step 6 — audit log
    await log_action(
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        action="uploaded",
        invoice_id=invoice.id,
        ip_address=ip_address,
        extra_data={
            "file_type": file_type,
            "file_size_bytes": file_size,
            "category": category,
        }
    )

    # Step 7 — trigger background extraction
    # Import here to avoid circular imports
    from app.workers.tasks import extract_invoice_task
    extract_invoice_task.delay(str(invoice.id))

    return {
        "invoice_id": str(invoice.id),
        "status": "pending_review",
        "extraction_status": "pending",
        "message": "Invoice uploaded. Extraction in progress."
    }


async def get_invoices(
    tenant_id: uuid.UUID,
    current_user: User,
    db: AsyncSession,
    page: int = 1,
    limit: int = 20,
    status_filter: str | None = None,
    category: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict:
    """
    Get paginated list of invoices for the tenant.
    Owner sees all invoices.
    Staff sees only their own uploads.
    """
    query = select(Invoice).where(
        and_(
            Invoice.tenant_id == tenant_id,
            Invoice.deleted_at == None,
        )
    )

    # Staff can only see their own uploads
    if current_user.role == "staff":
        query = query.where(Invoice.uploaded_by == current_user.id)

    # Optional filters
    if status_filter:
        query = query.where(Invoice.status == status_filter)
    if category:
        query = query.where(Invoice.category == category)
    if date_from:
        query = query.where(Invoice.upload_date >= date_from)
    if date_to:
        query = query.where(Invoice.upload_date <= date_to)

    # Get total count for pagination
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)

    # Apply pagination
    offset = (page - 1) * limit
    query = query.order_by(Invoice.upload_date.desc()).offset(offset).limit(limit)

    result = await db.execute(query)
    invoices = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "pages": math.ceil(total / limit),
        "items": invoices,
    }


async def get_invoice(
    invoice_id: uuid.UUID,
    current_user: User,
    db: AsyncSession,
) -> dict:
    """
    Get a single invoice with extracted data, line items,
    and a fresh signed URL for viewing the file.
    """
    query = select(Invoice).where(
        and_(
            Invoice.id == invoice_id,
            Invoice.tenant_id == current_user.tenant_id,
            Invoice.deleted_at == None,
        )
    )

    # Staff can only see their own uploads
    if current_user.role == "staff":
        query = query.where(Invoice.uploaded_by == current_user.id)

    result = await db.execute(query)
    invoice = result.scalar_one_or_none()

    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )

    # Get extracted data
    extracted_result = await db.execute(
        select(ExtractedData).where(ExtractedData.invoice_id == invoice_id)
    )
    extracted_data = extracted_result.scalar_one_or_none()

    # Get line items
    line_items_result = await db.execute(
        select(LineItem)
        .where(LineItem.invoice_id == invoice_id)
        .order_by(LineItem.sort_order)
    )
    line_items = line_items_result.scalars().all()

    # Generate fresh signed URL
    signed_url = generate_signed_url(invoice.file_path)

    return {
        "invoice": invoice,
        "extracted_data": extracted_data,
        "line_items": line_items,
        "signed_url": signed_url,
    }


async def approve_invoice(
    invoice_id: uuid.UUID,
    current_user: User,
    db: AsyncSession,
    ip_address: str | None = None,
) -> Invoice:
    """
    Approve an invoice — financial authorisation.
    Only owners or staff with can_approve permission.
    Invoice must be in pending_review status.
    """
    invoice = await _get_invoice_or_404(invoice_id, current_user, db)

    if invoice.status != "pending_review":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invoice cannot be approved. "
                   f"Current status: {invoice.status}"
        )

    if invoice.extraction_status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invoice extraction is not complete yet. "
                   "Please wait for extraction to finish before approving."
        )

    invoice.status = "approved"

    await log_action(
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        action="approved",
        invoice_id=invoice_id,
        ip_address=ip_address,
    )

    return invoice


async def reject_invoice(
    invoice_id: uuid.UUID,
    reason: str | None,
    current_user: User,
    db: AsyncSession,
    ip_address: str | None = None,
) -> Invoice:
    """
    Reject an invoice.
    Only owners or staff with can_approve permission.
    """
    invoice = await _get_invoice_or_404(invoice_id, current_user, db)

    if invoice.status not in ("pending_review",):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invoice cannot be rejected. "
                   f"Current status: {invoice.status}"
        )

    invoice.status = "rejected"

    await log_action(
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        action="rejected",
        invoice_id=invoice_id,
        ip_address=ip_address,
        extra_data={"reason": reason or "No reason provided"}
    )

    return invoice


async def update_extracted_data(
    invoice_id: uuid.UUID,
    updates: dict,
    current_user: User,
    db: AsyncSession,
    ip_address: str | None = None,
) -> ExtractedData:
    """
    Human correction of Claude's extraction.
    Records what changed for audit purposes.
    """
    invoice = await _get_invoice_or_404(invoice_id, current_user, db)

    result = await db.execute(
        select(ExtractedData).where(ExtractedData.invoice_id == invoice_id)
    )
    extracted = result.scalar_one_or_none()

    if not extracted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Extracted data not found for this invoice"
        )

    # Track what changed for audit log
    changes = {}
    for field, new_value in updates.items():
        old_value = getattr(extracted, field, None)
        if old_value != new_value:
            changes[field] = {
                "old": str(old_value),
                "new": str(new_value)
            }
            setattr(extracted, field, new_value)

    extracted.edited_by = current_user.id
    extracted.edited_at = datetime.now(timezone.utc)

    await log_action(
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        action="edited",
        invoice_id=invoice_id,
        ip_address=ip_address,
        extra_data={"changes": changes}
    )

    return extracted


async def delete_invoice(
    invoice_id: uuid.UUID,
    current_user: User,
    db: AsyncSession,
    ip_address: str | None = None,
) -> None:
    """
    Soft delete an invoice.
    Sets deleted_at and deleted_by — never hard deletes.
    """
    invoice = await _get_invoice_or_404(invoice_id, current_user, db)

    invoice.deleted_at = datetime.now(timezone.utc)
    invoice.deleted_by = current_user.id

    await log_action(
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        action="deleted",
        invoice_id=invoice_id,
        ip_address=ip_address,
    )


async def _get_invoice_or_404(
    invoice_id: uuid.UUID,
    current_user: User,
    db: AsyncSession,
) -> Invoice:
    """
    Shared helper — fetch invoice or raise 404.
    Enforces tenant isolation and soft delete filter.
    """
    result = await db.execute(
        select(Invoice).where(
            and_(
                Invoice.id == invoice_id,
                Invoice.tenant_id == current_user.tenant_id,
                Invoice.deleted_at == None,
            )
        )
    )
    invoice = result.scalar_one_or_none()

    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )

    return invoice
