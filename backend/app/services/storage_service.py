import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from azure.storage.blob import (
    BlobServiceClient,
    BlobSasPermissions,
    ContentSettings,
    generate_blob_sas,
)
from fastapi import HTTPException, status
from app.core.config import settings

ALLOWED_FILE_TYPES = {"application/pdf", "image/jpeg", "image/png"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10MB


def get_blob_client():
    return BlobServiceClient.from_connection_string(
        settings.AZURE_STORAGE_CONNECTION_STRING
    )


def hash_file(contents: bytes) -> str:
    return hashlib.sha256(contents).hexdigest()


def validate_file(contents: bytes, content_type: str) -> None:
    if content_type not in ALLOWED_FILE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed. Allowed: PDF, JPEG, PNG"
        )
    if len(contents) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size is 10MB"
        )


async def upload_file(
    contents: bytes,
    content_type: str,
    tenant_id: uuid.UUID,
) -> tuple[str, str, int]:
    """
    Upload file to Azure Blob Storage.
    Returns: (file_path, file_hash, file_size_bytes)
    """
    validate_file(contents, content_type)

    file_hash = hash_file(contents)

    extension = {
        "application/pdf": "pdf",
        "image/jpeg": "jpeg",
        "image/png": "png",
    }[content_type]

    file_id = uuid.uuid4()
    file_path = f"invoices/{tenant_id}/{file_id}.{extension}"

    client = get_blob_client()
    container = client.get_container_client(
        settings.AZURE_STORAGE_CONTAINER_NAME
    )

    from azure.storage.blob import ContentSettings

    container.upload_blob(
        name=file_path,
        data=contents,
        content_settings=ContentSettings(content_type=content_type),
        overwrite=False,
    )

    return file_path, file_hash, len(contents)


FILE_TYPE_CONTENT_TYPES = {
    "pdf": "application/pdf",
    "jpeg": "image/jpeg",
    "png": "image/png",
}


def download_file(file_path: str) -> tuple[bytes, str]:
    """Download a file from Azure Blob Storage. Returns (contents, content_type)."""
    client = get_blob_client()
    container = client.get_container_client(settings.AZURE_STORAGE_CONTAINER_NAME)
    blob = container.download_blob(file_path)
    contents = blob.readall()
    extension = file_path.rsplit(".", 1)[-1].lower()
    content_type = FILE_TYPE_CONTENT_TYPES.get(extension, "application/octet-stream")
    return contents, content_type


def generate_signed_url(file_path: str) -> str:
    """
    Generate a long-lived signed URL for viewing a file.
    """
    client = get_blob_client()
    account_name = client.account_name
    
    # --- FIXED: Parse key securely from connection string dict mapping ---
    account_key = None
    conn_str = settings.AZURE_STORAGE_CONNECTION_STRING
    for pair in conn_str.split(";"):
        if pair.startswith("AccountKey="):
            account_key = pair.split("=", 1)[1]
            break

    if not account_key:
        raise ValueError("AccountKey could not be resolved from Azure Connection String.")

    sas_token = generate_blob_sas(
        account_name=account_name,
        container_name=settings.AZURE_STORAGE_CONTAINER_NAME,
        blob_name=file_path,
        account_key=account_key,
        permission=BlobSasPermissions(read=True),
        expiry=datetime.now(timezone.utc) + timedelta(hours=24), # Generous 24-hour window
    )

    return (
        f"https://{account_name}.blob.core.windows.net/"
        f"{settings.AZURE_STORAGE_CONTAINER_NAME}/{file_path}?{sas_token}"
    )
