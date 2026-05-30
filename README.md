# InvoiceIQ

AI-powered invoice processing for SMEs. Upload an invoice or receipt —
Claude extracts vendor, line items, totals, and dates into structured data.
Multi-tenant SaaS with human-in-the-loop review and full audit trail.

## Stack

**Backend:** Python 3.11, FastAPI, PostgreSQL, SQLAlchemy, Alembic
**Frontend:** React (Vite), TanStack Query, Tailwind CSS, Shadcn/ui
**AI:** Anthropic Claude API (document extraction)
**Storage:** Azure Blob Storage
**Infrastructure:** Docker, GitHub Actions

## Quick Start

Clone the repo and set up backend and frontend separately.

### Backend
cd backend
cp .env.example .env
pip install -r requirements.txt
uvicorn app.main:app --reload

### Frontend
cd frontend
npm install
npm run dev

## Architecture

- Multi-tenant with Row Level Security (PostgreSQL)
- JWT authentication with role-based and permission-based access
- Background Claude extraction with status polling
- Signed Azure Blob URLs — never public
- Full audit log on every action
- Soft deletes — financial records never hard deleted

## Project Structure

invoiceiq/
├── backend/
│   ├── app/
│   │   ├── api/routes/     HTTP layer only
│   │   ├── core/           config, security, database
│   │   ├── models/         SQLAlchemy models
│   │   ├── schemas/        Pydantic request/response
│   │   ├── services/       business logic
│   │   └── main.py
│   ├── migrations/         Alembic
│   └── tests/
└── frontend/
    └── src/
        ├── components/
        ├── pages/
        ├── services/       API calls
        └── store/          Zustand global state
