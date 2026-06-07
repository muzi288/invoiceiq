from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "invoiceiq",
    broker=settings.REDIS_URL,
    backend=None,        # results go to PostgreSQL, not Redis
    include=["app.workers.tasks"],
)

celery_app.conf.update(
    task_ignore_result=True,     # don't store results in Redis
    task_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    worker_prefetch_multiplier=1,
    # one task at a time per worker
    # prevents a slow extraction blocking faster ones
    task_acks_late=True,
    # acknowledge task only after completion
    # if worker crashes mid-task, Redis re-queues it
)
