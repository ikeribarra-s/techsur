# TechSur — Sistema de Gestión Interna

Internal management system for a tech resale business. Handles inventory, purchases, sales, trade-ins (permutas), clients, and suppliers.

## Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, SQLAlchemy (async), asyncpg |
| Database | PostgreSQL via Supabase |
| Auth | JWT (httpOnly cookie) + bcrypt |
| File storage | Supabase Storage |
| Frontend | React 18, Vite, Tailwind CSS v4, React Router v7 |

## Project Structure

```
techsur-app/
├── backend/
│   ├── models/        # SQLAlchemy ORM models + enums
│   ├── routers/       # FastAPI route handlers
│   ├── schemas/       # Pydantic request/response schemas
│   ├── auth.py        # JWT creation and cookie verification
│   ├── config.py      # Pydantic settings (reads from .env)
│   ├── database.py    # Async engine + session factory
│   ├── limiter.py     # slowapi rate limiter
│   └── main.py        # App entry point, middleware
├── frontend/
│   └── src/app/
│       ├── components/ # Shared UI components
│       ├── pages/      # Route-level page components
│       ├── api.ts      # Typed fetch client
│       └── routes.tsx  # React Router config + auth loader
├── .env.example        # Environment variable template
└── requirements.txt
```

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+ and pnpm
- A Supabase project (PostgreSQL + Storage bucket named `product-photos`)

### Backend

```bash
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Generate a secure `SECRET_KEY`:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Run the API:

```bash
uvicorn backend.main:app --reload
```

The API will be available at `http://localhost:8000`. Interactive docs at `/docs`.

### Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

The app will be available at `http://localhost:5173`.

Set `VITE_API_URL` in `frontend/.env.local` if your backend runs on a different URL:

```
VITE_API_URL=http://localhost:8000
```

## Environment Variables

See `.env.example` for the full list. Key variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (asyncpg format) |
| `SECRET_KEY` | JWT signing key — generate with `secrets.token_hex(32)` |
| `ALLOWED_ORIGINS` | JSON array of allowed frontend origins, e.g. `["https://yourapp.vercel.app"]` |
| `COOKIE_SECURE` | Set `true` in production (requires HTTPS) |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_KEY` | Supabase service role key |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT lifetime in minutes (default: 60) |
| `MAX_UPLOAD_MB` | Max photo upload size in MB (default: 10) |

## Authentication

Sessions use `httpOnly` cookies (not localStorage). The JWT is never accessible from JavaScript. On login the backend sets the cookie; on logout it is cleared via `POST /auth/logout`.

The login endpoint is rate-limited to **5 requests per minute per IP**.

## Deployment

### Frontend (Vercel)

The `frontend/vercel.json` already includes the SPA rewrite rule. Set `VITE_API_URL` as an environment variable in the Vercel dashboard.

### Backend

1. Set `COOKIE_SECURE=true` and update `ALLOWED_ORIGINS` to your Vercel frontend URL.
2. Ensure HTTPS is enforced at your reverse proxy — HTTP requests must redirect to HTTPS for `Secure` + `SameSite=None` cookies to work cross-origin.
3. Rotate `SECRET_KEY`, `SUPABASE_KEY`, and the database password before going live.
