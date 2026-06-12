import asyncio
import uuid
from app.workers.celery_app import celery_app


@celery_app.task(
    name="extract_invoice",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def extract_invoice_task(self, invoice_id: str) -> None:
    """
    Celery task — runs in background worker process.
    Creates a fresh event loop on every execution including retries.
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(_run_extraction(self, invoice_id))
    finally:
        loop.close()


async def _run_extraction(task_instance, invoice_id: str) -> None:
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.models.invoice import Invoice
    from app.services.storage_service import get_blob_client
    from app.services.extraction_service import extract_invoice
    from app.core.config import settings

    # Step 1 — fetch invoice and set processing status
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Invoice).where(Invoice.id == uuid.UUID(invoice_id))
        )
        invoice = result.scalar_one_or_none()

        if not invoice:
            return

        file_path = invoice.file_path
        file_type = invoice.file_type
        invoice.extraction_status = "processing"
        await db.commit()

    # Step 2 — download from Azure outside transaction
    try:
        blob_client = get_blob_client()
        container = blob_client.get_container_client(
            settings.AZURE_STORAGE_CONTAINER_NAME
        )
        blob = container.get_blob_client(file_path)
        loop = asyncio.get_event_loop()
        file_contents = await loop.run_in_executor(
            None,
            lambda: blob.download_blob().readall()
        )
    except Exception as e:
        print(f"[Task] Storage download failed: {e}")
        raise task_instance.retry(exc=e, countdown=30)

    # Step 3 — run extraction in fresh session
    try:
        async with AsyncSessionLocal() as db:
            await extract_invoice(
                invoice_id=uuid.UUID(invoice_id),
                file_contents=file_contents,
                file_type=file_type,
                db=db,
            )
            await db.commit()
    except Exception as e:
        print(f"[Task] Extraction tracking failure: {e}")
        raise task_instance.retry(exc=e, countdown=60)