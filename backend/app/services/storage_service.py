import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from azure.storage.blob import (
    BlobServiceClient,
    BlobSasPermissions,
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

    container.upload_blob(
        name=file_path,
        data=contents,
        content_settings={"content_type": content_type},
        overwrite=False,
    )

    return file_path, file_hash, len(contents)


def generate_signed_url(file_path: str) -> str:
    """
    Generate a signed URL for viewing a file.
    URL expires in 15 minutes.
    """
    client = get_blob_client()
    account_name = client.account_name
    account_key = client.credential.account_key

    sas_token = generate_blob_sas(
        account_name=account_name,
        container_name=settings.AZURE_STORAGE_CONTAINER_NAME,
        blob_name=file_path,
        account_key=account_key,
        permission=BlobSasPermissions(read=True),
        expiry=datetime.now(timezone.utc) + timedelta(minutes=15),
    )

    return (
        f"https://{account_name}.blob.core.windows.net/"
        f"{settings.AZURE_STORAGE_CONTAINER_NAME}/{file_path}?{sas_token}"
    )
    