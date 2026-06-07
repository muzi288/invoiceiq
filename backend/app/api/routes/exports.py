from fastapi import APIRouter, Depends, Query
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

router = APIRouter(prefix="/exports", tags=["exports"])


@router.get("/invoices")
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
