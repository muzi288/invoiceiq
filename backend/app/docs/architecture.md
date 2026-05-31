# InvoiceIQ — Architecture & Design Decisions

## Table of Contents
1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Database Design](#database-design)
4. [Authentication & Security](#authentication--security)
5. [Multi-Tenancy](#multi-tenancy)
6. [API Layer](#api-layer)
7. [AI Integration](#ai-integration)
8. [File Storage](#file-storage)
9. [Background Processing](#background-processing)
10. [Key Concepts Explained](#key-concepts-explained)

---

## Project Overview

InvoiceIQ is a multi-tenant SaaS platform that helps SMEs digitise their invoice and receipt processing. Staff upload invoice files (PDF, JPEG, PNG), Claude AI extracts structured data (vendor, line items, totals, dates), and a human reviewer confirms or corrects the extraction before it enters the business's financial records.

**Core problems solved:**
- Manual invoice data entry is slow and error-prone
- No audit trail for who processed which invoice
- Duplicate invoice payments due to lack of duplicate detection
- No structured expense reporting for SMEs

---

## Technology Stack

### Backend

| Tool | Purpose | Why chosen |
|------|---------|------------|
| Python 3.11 | Runtime | Modern typing syntax, 60% faster than 3.9, wide library support |
| FastAPI | Web framework | Async-first, automatic OpenAPI docs, Pydantic integration |
| SQLAlchemy 2.0 | ORM | Async support, type-safe queries, Alembic integration |
| Alembic | Migrations | Version control for database schema changes |
| asyncpg | DB driver (runtime) | Async PostgreSQL driver for SQLAlchemy |
| psycopg2 | DB driver (migrations) | Sync driver required by Alembic |
| Pydantic v2 | Validation | Automatic request/response validation, serialisation |
| python-jose | JWT | Create and verify JSON Web Tokens |
| passlib + bcrypt | Password hashing | Industry standard, slow by design to resist brute force |
| Celery + Redis | Background tasks | Claude extraction runs async, does not block HTTP response |
| Azure Blob Storage | File storage | Scalable, cheap, supports signed URLs for secure access |
| Anthropic Claude API | AI extraction | Document understanding, structured JSON extraction |

### Frontend

| Tool | Purpose |
|------|---------|
| React + Vite | UI framework, fast dev server |
| TanStack Query | Server state, polling extraction status |
| Tailwind CSS | Utility-first styling |
| Shadcn/ui | Accessible pre-built components |
| Zustand | Global auth state |
| Axios | HTTP client with JWT interceptors |

---

## Database Design

### Why PostgreSQL

- ACID transactions — financial data must be consistent
- Row Level Security (RLS) — database-level multi-tenant isolation
- JSONB columns — store raw Claude responses without a fixed schema
- Array columns — tags on invoices
- NUMERIC type — exact decimal arithmetic for currency, never FLOAT

### Schema Overview

tenants (1) owns tenant_settings (1:1), users (1:many). Users own invoices (1:many). Invoices own extracted_data (1:1), line_items (1:many), and audit_log entries (1:many).

### Table Design Decisions

**tenants** — Top-level entity. Every row in every other table belongs to a tenant. is_active allows suspension without deletion.

**tenant_settings** — Separated from tenants to keep the tenants table clean. Contains default currency, timezone, logo, notification preferences. Timezone stored as IANA string e.g. "Africa/Harare" not UTC offset, because offsets are ambiguous — UTC+2 could be multiple timezones. All timestamps in the database are UTC and converted to tenant timezone for display.

**users** — Two roles: owner and staff. Permission flags can_approve and can_export extend staff access selectively without creating rigid role hierarchies. Owner always has full access, enforced at application level. Passwords stored as bcrypt hashes, never plain text, never reversible.

**invoices** — Created immediately on file upload, before Claude processes anything. Two separate status fields: status tracks workflow state (pending_review, approved, rejected) and extraction_status tracks AI processing state (pending, processing, completed, failed). These are intentionally separate. A failed extraction does not affect the workflow status. Both need independent tracking. file_hash (SHA256) enables duplicate detection at upload time before Claude is called, saving API cost. file_path stores the Azure Blob path, never a public URL. Signed URLs are generated on demand and expire in 15 minutes. Soft deletes use deleted_at and deleted_by instead of hard DELETE. Financial records must never be permanently destroyed. All queries filter WHERE deleted_at IS NULL.

**extracted_data** — UNIQUE constraint on invoice_id means one extraction per invoice, always. This prevents duplicate extractions if Claude is called twice accidentally. raw_claude_response (JSONB) stores Claude's original output permanently and is used for audit trail, accuracy analytics, and reprocessing when the model improves. is_multi_currency flag is set when Claude detects mixed currencies across line items and triggers a warning in the UI to verify total manually.

**line_items** — Each row is one line item from the invoice. Per-row currency field handles invoices with mixed currencies. sort_order preserves the original order items appeared on the invoice.

**audit_log** — Immutable. Rows are only ever inserted, never updated or deleted. Every meaningful action writes a row: uploaded, approved, rejected, edited, exported, deleted, user_created, permission_granted, extraction_failed, extraction_completed. extra_data (JSONB) stores flexible context per action type. For edited actions it stores the field name, old value, and new value. For exported actions it stores the filters used. For rejected actions it stores the reason.

---

## Authentication & Security

### JWT (JSON Web Tokens)

HTTP is stateless — the server has no memory between requests. JWT solves this: on login, the server creates a signed token containing the user's identity and sends it to the frontend. The frontend attaches it to every subsequent request. The server verifies the signature and extracts the identity without touching the database.

Token payload contains user_id, tenant_id, role (owner or staff), can_approve (boolean), can_export (boolean), and exp (expiry timestamp).

The signature is cryptographic — users cannot tamper with the payload. If someone changes role to owner, the signature becomes invalid and the server rejects the token. Token expiry is 60 minutes. After expiry, the user must log in again. Logout means the frontend discards the token. The server is stateless so there is nothing to delete server-side. Production would add a Redis token blacklist.

### Password Hashing (bcrypt)

Passwords are never stored in plain text. bcrypt is a slow hashing algorithm by design — this is intentional. A fast hash like MD5 or SHA256 can be brute-forced at billions per second. bcrypt is tunable to take approximately 100ms per hash, making brute force impractical. When a user registers, bcrypt hashes the password and the database stores the hash, never the original. When a user logs in, bcrypt verifies the plain password against the stored hash. The original password is never recoverable, even by the application developers.

---

## Multi-Tenancy

InvoiceIQ is a multi-tenant SaaS — multiple businesses share the same database and application but their data is completely isolated.

### Two Layers of Isolation

**Layer 1 — Application level (FastAPI)** — Every request carries a JWT token containing tenant_id. Every database query adds WHERE tenant_id = :tenant_id. Even if a developer forgets the filter, Layer 2 catches it.

**Layer 2 — Database level (PostgreSQL Row Level Security)** — RLS policies attached to every table enforce tenant isolation at the database engine level. Before any query runs, PostgreSQL checks the session variable app.tenant_id and automatically filters rows. Even a raw SQL query with no WHERE clause returns only that tenant's data. FastAPI sets SET app.tenant_id = 'uuid' before every query. If a developer writes SELECT * FROM invoices with no filter, PostgreSQL automatically runs SELECT * FROM invoices WHERE tenant_id = 'uuid'. Defense in depth means both layers must fail simultaneously for a data breach to occur.

---

## API Layer

### Separation of Concerns

Routes handle HTTP only — they receive requests, call services, and return responses. No business logic lives in routes. Services contain all business logic, validation, rules, and orchestration. Services have no knowledge of HTTP and no access to request or response objects. Models define database tables and contain no business logic. Schemas define request and response shapes, handle validation, and control serialisation.

This separation means business logic is testable without running an HTTP server, routes are thin and easy to read, and switching frameworks later only requires rewriting routes.

### Pydantic Schemas

Every API endpoint has explicit input and output shapes defined as Pydantic models. FastAPI validates all incoming data automatically before it reaches application code. Invalid data returns a 422 error with specific field-level error messages — no manual validation needed.

from_attributes = True on response schemas allows Pydantic to read SQLAlchemy object attributes directly, bridging the ORM and API layers. Request schemas validate incoming JSON and form data. Response schemas control exactly what fields are returned. Sensitive fields like hashed_password and verification_token never appear in responses.

---

## AI Integration

### Claude Extraction Flow

The file is uploaded and saved to Azure Blob. An invoice row is created with extraction_status set to pending. A background Celery task is triggered and returns 202 immediately. The task downloads the file from Blob and sends it to the Claude API with an extraction prompt. Claude returns structured JSON containing vendor_name, invoice_number, invoice_date, due_date, subtotal, tax_amount, total_amount, currency, line_items array, confidence_score, and is_multi_currency flag. An ExtractedData row is created with Claude's response. raw_claude_response is saved and never modified. The invoice extraction_status is updated to completed. Frontend polling detects the completion and shows results to the user.

### Why Background Processing (Celery)

Claude takes 5-8 seconds to process a PDF. If the HTTP request waited for Claude, the user's browser would hang for 8 seconds — poor experience with risk of timeout. Instead the HTTP request returns immediately with the invoice_id and status pending. A Celery worker picks up the task and calls Claude in the background. The frontend polls GET /invoices/{id} every 2 seconds. When extraction_status changes to completed the results appear. The user sees a progress indicator, not a frozen screen.

### Duplicate Detection (File Hashing)

Before calling Claude, the uploaded file is hashed with SHA256. If the same file was uploaded before by the same tenant, the upload is rejected immediately with a duplicate invoice detected message. Claude is never called and API cost is saved.

### Raw Response Preservation

Claude's original JSON response is stored permanently in extracted_data.raw_claude_response for three reasons. First, audit trail — evidence of what the AI originally extracted. Second, accuracy analytics — comparing the raw response against human corrections measures and improves extraction quality over time. Third, reprocessing — when Claude improves, old invoices can be reprocessed without users re-uploading files.

---

## File Storage

### Azure Blob Storage

Invoice files are stored in Azure Blob Storage, not in the database or on the server filesystem. Storing binary files in PostgreSQL bloats the database, is slow to retrieve, and is expensive to back up. Storing files on the server filesystem means they are lost if the server restarts or scales, and they cannot be shared across multiple server instances. Azure Blob Storage is scalable, cheap, redundant by default, and supports signed URLs.

### Signed URLs (SAS Tokens)

Files are stored in a private container with no public access. When a user needs to view an invoice, FastAPI generates a Shared Access Signature (SAS) URL that points directly to the file, expires in 15 minutes, and requires no authentication headers from the browser. The frontend uses this URL to display the file in an iframe. When the URL expires the file is no longer directly accessible. File paths in the database are never public URLs.

---

## Background Processing

### Celery + Redis

Celery is a distributed task queue. Redis is the message broker that holds the queue of pending tasks. FastAPI is the producer — when an invoice is uploaded it adds an extraction task to the Redis queue and returns 202 immediately. The Celery worker is the consumer — it picks up tasks from Redis, calls the Claude API, saves extracted_data, and updates the invoice status. FastAPI and the Celery worker are separate processes. FastAPI handles HTTP. Celery handles long-running work. Redis is the communication channel between them.

---

## Key Concepts Explained

### Migrations (Alembic)
Version control for database schema. Every schema change is a numbered migration file with upgrade() and downgrade() functions. alembic upgrade head applies all pending migrations. alembic downgrade -1 rolls back one migration. The alembic_version table tracks which migrations have been applied. Every developer runs alembic upgrade head after pulling new code to sync their local database with the latest schema.

### Async/Await
FastAPI is async — it can handle thousands of concurrent requests. async def functions do not block while waiting for I/O such as database queries or API calls. While one request waits for PostgreSQL, FastAPI handles other requests simultaneously. asyncpg is the async PostgreSQL driver that makes this possible.

### Connection Pooling
Opening a new database connection takes approximately 50ms. A connection pool keeps N connections open and reuses them. pool_size=10 means 10 connections are always ready. max_overflow=20 means 20 extra connections are allowed under heavy load. Requests do not wait to open connections — they grab one from the pool immediately.

### ACID Transactions
Atomicity means all operations in a transaction succeed or all fail together. Consistency means data always moves from one valid state to another. Isolation means concurrent transactions do not interfere with each other. Durability means committed data survives crashes. PostgreSQL guarantees all four ACID properties.

### Soft Deletes
Records have deleted_at set instead of being removed from the database. Financial records must never be permanently deleted. All queries filter WHERE deleted_at IS NULL to exclude deleted records. Deleted records remain available for audit and recovery.

### NUMERIC vs FLOAT for Currency
FLOAT uses binary floating point and cannot represent most decimal numbers exactly. 0.1 + 0.2 equals 0.30000000000000004 in floating point arithmetic. NUMERIC(12,2) stores exact decimal values with no rounding errors. Always use NUMERIC for money. Never use FLOAT.

### The Four-Layer Security Model
A request arrives carrying a JWT token. The JWT is decoded and user_id, tenant_id, and role are extracted. FastAPI sets the PostgreSQL session variable app.tenant_id. The application query adds WHERE tenant_id = :tenant_id as Layer 1. PostgreSQL RLS enforces the tenant_id filter as Layer 2. Schema constraints ensure returned data is typed, valid, and structurally correct as Layer 3. The Pydantic response schema strips sensitive fields before data leaves the server as Layer 4. All four layers must fail simultaneously for a security breach to occur.
