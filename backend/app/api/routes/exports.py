from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime
import csv
import io

from app.core.database import get_db
from app.core.dependencies import get_current_exporter
from app.models.user import User
from app.services import invoice_service
from app.services.audit_service import log_action

router = APIRouter(prefix="/exports", tags=["exports"])


@router.get("/invoices")
async def export_invoices(
    request: Request,
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
        "Invoice ID", "Vendor", "Invoice Number", "Total", "Currency",
        "Category", "Uploaded By", "Upload Date", "Payment Status"
    ])

    for inv in invoices:
        writer.writerow([
            str(inv["id"]),
            inv.get("vendor_name") or "",
            inv.get("invoice_number") or "",
            inv.get("total_amount") or "",
            inv.get("currency") or "",
            inv.get("category") or "",
            inv.get("uploaded_by_name") or "",
            inv["upload_date"].strftime("%Y-%m-%d") if inv.get("upload_date") else "",
            inv.get("payment_status") or "unpaid",
        ])

    await log_action(
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        action="exported",
        ip_address=request.client.host if request.client else None,
        extra_data={
            "row_count": len(invoices),
            "category": category,
            "date_from": date_from,
            "date_to": date_to,
        },
    )

    output.seek(0)
    filename = f"invoices_{datetime.now().strftime('%Y%m%d')}.csv"

    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
