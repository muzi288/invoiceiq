import asyncio
import uuid
from app.workers.celery_app import celery_app


@celery_app.task(
    name="extract_invoice",
    max_retries=3,
    default_retry_delay=60,
)
def extract_invoice_task(invoice_id: str) -> None:
    """
    Celery task — runs in background worker process.
    Downloads file from Azure, sends to extraction service,
    saves results to database.

    max_retries=3: if extraction fails, retry up to 3 times
    default_retry_delay=60: wait 60 seconds between retries
    """
    asyncio.run(_run_extraction(invoice_id))


async def _run_extraction(invoice_id: str) -> None:
    """
    Async extraction logic.
    Celery tasks are synchronous — asyncio.run() bridges
    the sync Celery world to our async SQLAlchemy/service code.
    """
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.models.invoice import Invoice
    from app.services.storage_service import get_blob_client
    from app.services.extraction_service import extract_invoice
    from app.core.config import settings

    async with AsyncSessionLocal() as db:
        try:
            # Get invoice from database
            result = await db.execute(
                select(Invoice).where(
                    Invoice.id == uuid.UUID(invoice_id)
                )
            )
            invoice = result.scalar_one_or_none()

            if not invoice:
                return

            # Download file from Azure Blob
            blob_client = get_blob_client()
            container = blob_client.get_container_client(
                settings.AZURE_STORAGE_CONTAINER_NAME
            )
            blob = container.get_blob_client(invoice.file_path)
            file_contents = blob.download_blob().readall()

            # Run extraction
            await extract_invoice(
                invoice_id=invoice.id,
                file_contents=file_contents,
                file_type=invoice.file_type,
                db=db,
            )

            await db.commit()

        except Exception as e:
            await db.rollback()
            raise extract_invoice_task.retry(
                exc=e,
                countdown=60,
            )
