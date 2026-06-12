from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.routes import auth, invoices, users, audit, settings as settings_router, exports, vendors

app = FastAPI(
    title="InvoiceIQ",
    description="AI-powered invoice processing for SMEs",
    version="1.0.0",
)

# CORS — allows React frontend to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routers
app.include_router(auth.router)
app.include_router(invoices.router)
app.include_router(users.router)
app.include_router(audit.router)
app.include_router(settings_router.router)
app.include_router(exports.router)
app.include_router(vendors.router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
