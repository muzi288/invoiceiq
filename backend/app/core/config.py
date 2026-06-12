from pydantic_settings import BaseSettings
from typing import Any


class Settings(BaseSettings):
    # App
    APP_ENV: str = "development"
    APP_PORT: int = 8000
    FRONTEND_URL: str = "http://localhost:5173"

    # Database
    DATABASE_URL: str

    # JWT
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_MINUTES: int = 60

    # Azure Blob Storage
    AZURE_STORAGE_CONNECTION_STRING: str
    AZURE_STORAGE_CONTAINER_NAME: str = "invoiceiq-files"

    # Anthropic
    ANTHROPIC_API_KEY: str
    GEMINI_API_KEY: str = ""
    OPENROUTER_API_KEY: str = ""
    EXTRACTION_PROVIDER: str = "gemini"


    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # Email (optional — logs to console when unset)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_USE_TLS: bool = True

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
