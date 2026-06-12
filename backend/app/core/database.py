import os
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from app.core.config import settings

DATABASE_URL = settings.DATABASE_URL.replace(
    "postgresql://", "postgresql+asyncpg://"
)

# Initialize the global engine instance (used by your main FastAPI application process)
engine = create_async_engine(
    DATABASE_URL,
    echo=settings.APP_ENV == "development",
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# --- CELERY WORKER FORK PROTECTION ---
try:
    from celery.signals import worker_process_init

    @worker_process_init.connect
    def configure_workers_database_pool(*args, **kwargs):
        """
        Forces Celery child worker forks to drop the shared connection pool
        and safely spin up process-isolated asyncpg connection wrappers.
        """
        global engine, AsyncSessionLocal
        
        print(f"[Database] Re-initializing isolated DB engine pool for Process ID: {os.getpid()}")
        
        # 1. Dispose of the parent engine and clean socket states cleanly
        engine.sync_engine.dispose()
        
        # 2. Re-create a process-safe engine dedicated to this specific fork
        engine = create_async_engine(
            DATABASE_URL,
            echo=settings.APP_ENV == "development",
            pool_size=4,  # Keep worker limits low to avoid hitting Postgres max_connections
            max_overflow=10,
        )
        
        # 3. Update your sessionmaker configurations with the new engine pointer
        AsyncSessionLocal.configure(bind=engine)

except ImportError:
    # Safely bypass setup if this file is called outside of a Celery environment context
    pass
