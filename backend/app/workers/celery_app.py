# app/workers/celery_app.py
from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "invoiceiq",
    broker=settings.REDIS_URL,
    backend=None,        
    include=["app.workers.tasks"],  # This tells Celery where to look for tasks
)

celery_app.conf.update(
    task_ignore_result=True,     
    task_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
)
