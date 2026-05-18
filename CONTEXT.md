# TechSur — Full Codebase Context

This document is intended for AI agents performing refactoring, feature work, or code review. It describes every layer of the application in enough detail to make accurate, non-breaking changes.

---

## 1. What the App Does

TechSur is an **internal management system for a tech-device resale business**. It manages:

- **Inventario** — product stock (phones, tablets, etc.)
- **Compras** — purchases from suppliers
- **Ventas** — sales to clients, including trade-in amounts
- **Permutas** — trade-in devices received from clients
- **Clientes** — client records
- **Proveedores** — supplier records
- **Catálogo** — public-facing product listing (no auth required)
- **Dashboard** — KPIs: monthly revenue, sales count, gross margin, stock levels

The app is single-user (one admin account). There is no user registration flow.

---

## 2. Tech Stack

### Backend
| Concern | Library / Tool |
|---|---|
| Framework | FastAPI |
| ORM | SQLAlchemy 2.x (async, `mapped_column` style) |
| DB driver | asyncpg |
| Database | PostgreSQL hosted on Supabase |
| Auth | JWT (python-jose) + bcrypt, delivered via httpOnly cookie |
| File storage | Supabase Storage (bucket: `product-photos`) |
| Config | pydantic-settings (reads `.env`) |
| Rate limiting | slowapi (limits by remote IP) |
| HTTP client | httpx (async, used for Supabase Storage uploads) |
| Runtime | uvicorn |

### Frontend
| Concern | Library / Tool |
|---|---|
| Framework | React 18 |
| Build tool | Vite 6 |
| Language | TypeScript (JSX/TSX, no strict tsconfig — no `tsc` installed) |
| Routing | React Router v7 (`createBrowserRouter`) |
| Styling | Tailwind CSS v4 (via `@tailwindcss/vite` plugin) |
| UI primitives | Radix UI (Dialog, DropdownMenu, Select, Tabs, Tooltip, etc.) |
| Forms | react-hook-form (used in some pages) |
| Charts | recharts (Dashboard) |
| Toasts | sonner |
| Icons | lucide-react |
| Date utils | date-fns |
| Package manager | pnpm |

---

## 3. Repository Layout

```
techsur-app/
├── .env                        # Local secrets — gitignored, never committed
├── .env.example                # Safe template committed to repo
├── .gitignore
├── requirements.txt            # Python dependencies
├── README.md
├── CONTEXT.md                  # This file
│
├── backend/
│   ├── main.py                 # FastAPI app, CORS, rate limiter wiring
│   ├── config.py               # Pydantic Settings class
│   ├── database.py             # Async SQLAlchemy engine + session factory
│   ├── auth.py                 # create_access_token, verify_token (cookie-based)
│   ├── limiter.py              # slowapi Limiter instance
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   ├── enums.py            # Python str enums for all constrained fields
│   │   ├── usuario.py
│   │   ├── producto.py         # Has selectin relationship to ProductoFoto
│   │   ├── producto_foto.py
│   │   ├── cliente.py
│   │   ├── proveedor.py
│   │   ├── compra.py
│   │   ├── venta.py
│   │   └── permuta.py
│   │
│   ├── schemas/
│   │   ├── auth.py             # Token response schema
│   │   ├── producto.py
│   │   ├── cliente.py
│   │   ├── proveedor.py
│   │   ├── compra.py
│   │   ├── venta.py
│   │   └── permuta.py
│   │
│   └── routers/
│       ├── __init__.py
│       ├── auth.py             # POST /auth/token, POST /auth/logout
│       ├── producto.py         # CRUD + photo upload/delete
│       ├── cliente.py
│       ├── proveedor.py
│       ├── compra.py
│       ├── venta.py
│       └── permuta.py
│
└── frontend/
    ├── package.json
    ├── vercel.json             # SPA rewrite: /* → /index.html
    ├── vite.config.ts (not present — Tailwind is wired via pnpm plugin)
    └── src/
        ├── main.tsx            # React root, RouterProvider
        ├── styles/
        │   ├── index.css
        │   ├── tailwind.css
        │   ├── fonts.css
        │   └── theme.css
        └── app/
            ├── api.ts          # Typed fetch client + all TypeScript interfaces
            ├── routes.tsx      # Router config + authLoader
            ├── lib/
            │   └── utils.ts    # formatCurrency, formatDate, exportCSV, cn()
            ├── components/
            │   ├── Layout.tsx  # Nav shell, logout handler
            │   ├── Button.tsx
            │   ├── Input.tsx
            │   ├── Select.tsx
            │   ├── Textarea.tsx
            │   ├── Modal.tsx
            │   ├── Carousel.tsx
            │   ├── StatusBadge.tsx
            │   ├── ErrorMessage.tsx
            │   └── SuccessMessage.tsx
            └── pages/
                ├── Login.tsx
                ├── Dashboard.tsx
                ├── Inventario.tsx
                ├── Clientes.tsx
                ├── Ventas.tsx
                ├── Compras.tsx
                ├── Proveedores.tsx
                ├── Permutas.tsx
                └── Catalogo.tsx  # Public, no auth required
```

---

## 4. Configuration (`backend/config.py`)

All config is read from `.env` via `pydantic-settings`. The `Settings` object is instantiated once as `settings` and imported wherever needed.

```python
class Settings(BaseSettings):
    DATABASE_URL: str                                      # asyncpg format
    SECRET_KEY: str                                        # JWT signing key (hex 64 chars)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60                  # 1 hour
    BACKEND_URL: str = "http://localhost:8000"
    ALLOWED_ORIGINS: list[str] = ["http://localhost:5173"] # JSON array in .env
    COOKIE_SECURE: bool = False                            # True in production
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    MAX_UPLOAD_MB: int = 10
```

---

## 5. Database (`backend/database.py`)

- Uses `create_async_engine` + `async_sessionmaker`.
- For non-localhost URLs, SSL is enabled using `ssl.create_default_context()` (full cert verification).
- `statement_cache_size=0` is required for asyncpg with PgBouncer / Supabase connection pooling.
- `get_db()` is a FastAPI dependency that yields an `AsyncSession`.
- All models inherit from `Base = DeclarativeBase()`.
- No Alembic migrations — schema is managed directly in Supabase.

---

## 6. Authentication (`backend/auth.py`, `backend/routers/auth.py`)

### Flow
1. Client POSTs `application/x-www-form-urlencoded` with `username` + `password` to `POST /auth/token`.
2. Backend verifies password with `bcrypt.checkpw`.
3. On success, a JWT is created and set as an `httpOnly` cookie named `token`.
4. All subsequent requests send the cookie automatically (`credentials: 'include'` on the frontend).
5. `verify_token(request: Request)` is a FastAPI dependency that reads `request.cookies.get("token")` and decodes the JWT.
6. On logout, `POST /auth/logout` calls `response.delete_cookie("token")`.

### Cookie attributes
| Attribute | Dev | Prod |
|---|---|---|
| `httponly` | True | True |
| `secure` | False | True |
| `samesite` | `lax` | `none` |
| `max_age` | `ACCESS_TOKEN_EXPIRE_MINUTES * 60` | same |

### Rate limiting
`POST /auth/token` is decorated with `@limiter.limit("5/minute")` (slowapi, keyed by remote IP). Exceeding the limit returns `429 Too Many Requests`.

### JWT payload
```json
{ "sub": "<username>", "exp": <unix timestamp> }
```

---

## 7. Data Models

All primary keys are `UUID` generated client-side with `uuid.uuid4()`. All timestamps use `TIMESTAMP(timezone=True)`.

### `usuarios`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| username | String(60) | unique |
| password_hash | String(255) | bcrypt hash |
| created_at | TIMESTAMP | server default |

### `productos`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| nombre | String(120) | |
| marca | String(60) | default "Apple" |
| modelo | String(80) | |
| storage | String(20) | nullable |
| color | String(40) | nullable |
| condicion | String(20) | enum: nuevo/usado/reacondicionado |
| bateria_salud | SmallInteger | nullable, 0–100 |
| precio_compra | Numeric(12,2) | |
| precio_venta | Numeric(12,2) | |
| estado | String(20) | enum: disponible/reservado/vendido |
| notas | Text | nullable |
| created_at / updated_at | TIMESTAMP | |

Has a `selectin` relationship to `producto_fotos` (loaded automatically on every query).

### `producto_fotos`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| producto_id | UUID FK → productos(id) CASCADE | |
| url | String(1000) | Supabase public URL |
| orden | Integer | display order |
| created_at | TIMESTAMP | |

### `clientes`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| nombre | String(80) | required |
| apellido | String(80) | nullable |
| dni | String(20) | nullable |
| telefono | String(40) | nullable |
| email | String(120) | nullable |
| direccion | Text | nullable |
| notas | Text | nullable |
| created_at / updated_at | TIMESTAMP | |

Cannot be deleted if they have associated ventas.

### `proveedores`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| nombre | String(100) | |
| contacto | String(100) | nullable |
| telefono | String(40) | nullable |
| email | String(120) | nullable |
| notas | Text | nullable |
| created_at / updated_at | TIMESTAMP | |

Cannot be deleted if they have associated compras.

### `compras`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| proveedor_id | UUID FK → proveedores SET NULL | nullable |
| producto_id | UUID FK → productos RESTRICT | |
| precio_unitario | Numeric(12,2) | |
| fecha_compra | Date | server default today |
| forma_pago | String(20) | enum: efectivo/transferencia/tarjeta |
| notas | Text | nullable |
| created_at | TIMESTAMP | |

### `ventas`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| producto_id | UUID FK → productos RESTRICT | |
| cliente_id | UUID FK → clientes SET NULL | nullable |
| precio_final | Numeric(12,2) | |
| forma_pago | String(20) | enum: efectivo/transferencia/tarjeta/mixto |
| monto_permuta | Numeric(12,2) | default 0 |
| notas | Text | nullable |
| fecha_venta | Date | server default today |
| created_at | TIMESTAMP | |

Creating a venta sets `producto.estado = "vendido"` atomically in the same transaction.

### `permutas`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| venta_id | UUID FK → ventas SET NULL | nullable |
| cliente_id | UUID FK → clientes SET NULL | nullable |
| marca | String(60) | |
| modelo | String(80) | |
| storage | String(20) | nullable |
| color | String(40) | nullable |
| condicion | String(20) | enum: bueno/regular/malo |
| bateria_salud | SmallInteger | nullable |
| valor_permuta | Numeric(12,2) | |
| notas | Text | nullable |
| created_at | TIMESTAMP | |

### Enums (`backend/models/enums.py`)
All are `str, enum.Enum` so they serialize to/from plain strings.

```python
class CondicionProducto: nuevo | usado | reacondicionado
class EstadoProducto:    disponible | reservado | vendido
class FormaPago:         efectivo | transferencia | tarjeta | mixto
class FormaPagoCompra:   efectivo | transferencia | tarjeta
class CondicionPermuta:  bueno | regular | malo
```

These enums are used in **all Pydantic schemas**. They are NOT used in the SQLAlchemy models (which store plain strings).

---

## 8. API Endpoints

All endpoints except `GET /`, `POST /auth/token`, `POST /auth/logout`, and `GET /productos/public` require a valid `token` cookie (`verify_token` dependency).

### Auth
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/token` | Login — sets httpOnly cookie. Rate limited 5/min. |
| POST | `/auth/logout` | Clears the cookie. |

### Productos
| Method | Path | Notes |
|---|---|---|
| GET | `/productos/` | Query param: `?estado=` filter |
| GET | `/productos/public` | No auth — returns `ProductoPublic` (no pricing) |
| GET | `/productos/{id}` | |
| POST | `/productos/` | |
| PUT | `/productos/{id}` | |
| DELETE | `/productos/{id}` | Blocked if `estado == "vendido"` |
| POST | `/productos/{id}/foto` | Upload image. Validates magic bytes (JPEG/PNG/WebP). Enforces MAX_UPLOAD_MB. Stores in Supabase Storage. |
| DELETE | `/productos/{id}/fotos/{foto_id}` | Removes DB record only — does NOT delete from Supabase Storage. |

### Clientes
| Method | Path | Notes |
|---|---|---|
| GET | `/clientes/` | Query param: `?busqueda=` — ilike on nombre, apellido, dni |
| GET | `/clientes/{id}` | |
| POST | `/clientes/` | |
| PUT | `/clientes/{id}` | |
| DELETE | `/clientes/{id}` | Blocked if client has ventas |

### Proveedores
| Method | Path | Notes |
|---|---|---|
| GET | `/proveedores/` | |
| GET | `/proveedores/{id}` | |
| POST | `/proveedores/` | |
| PUT | `/proveedores/{id}` | |
| DELETE | `/proveedores/{id}` | Blocked if proveedor has compras |

### Compras
| Method | Path | Notes |
|---|---|---|
| GET | `/compras/` | Query param: `?proveedor_id=` |
| GET | `/compras/{id}` | |
| POST | `/compras/` | |
| DELETE | `/compras/{id}` | |

### Ventas
| Method | Path | Notes |
|---|---|---|
| GET | `/ventas/` | |
| GET | `/ventas/labels` | Returns `[{id, label}]` — label is product name + client name. Used for select dropdowns. |
| GET | `/ventas/{id}` | |
| POST | `/ventas/` | Also sets `producto.estado = "vendido"` |
| PUT | `/ventas/{id}` | Does NOT revert producto estado |

### Permutas
| Method | Path | Notes |
|---|---|---|
| GET | `/permutas/` | |
| GET | `/permutas/{id}` | |
| POST | `/permutas/` | |
| DELETE | `/permutas/{id}` | |

---

## 9. Frontend Architecture

### API Client (`frontend/src/app/api.ts`)

Single typed fetch client. All requests go through `request()`.

- Base URL: `import.meta.env.VITE_API_URL ?? 'http://localhost:8000'`
- All requests use `credentials: 'include'` so the `httpOnly` cookie is sent automatically.
- No `Authorization` header — auth is entirely cookie-based.
- On `401`: clears `localStorage.loggedIn` and redirects to `/login`.
- On `204`: returns `null`.
- `uploadFile()` uses `FormData` (multipart), no `Content-Type` header (browser sets it with boundary).

Exports typed interfaces for all entities: `Producto`, `ProductoFoto`, `Cliente`, `Proveedor`, `Compra`, `Venta`, `Permuta`, `VentaLabel`.

### Routing (`frontend/src/app/routes.tsx`)

Uses `createBrowserRouter` from React Router v7.

```
/login          → Login (public)
/catalogo       → Catalogo (public)
/               → Layout (protected via authLoader)
  /             → Dashboard
  /inventario   → Inventario
  /clientes     → Clientes
  /ventas       → Ventas
  /proveedores  → Proveedores
  /compras      → Compras
  /permutas     → Permutas
```

**Auth guard** is an `authLoader` function on the `/` route. It runs synchronously before any component renders. If `localStorage.getItem('loggedIn')` is falsy, it returns `redirect('/login')`. This is a UX guard only — the real security is the `httpOnly` cookie checked server-side on every API call.

### State Management

No global state library. Each page manages its own state with `useState` + `useEffect`. Data is fetched on component mount and mutated optimistically or by re-fetching after writes.

### Page Overview

| Page | Key Features |
|---|---|
| `Login` | Submits form-urlencoded to `/auth/token`, sets `loggedIn` flag in localStorage |
| `Dashboard` | Fetches all ventas + productos, computes KPIs client-side (monthly revenue, margin, stock counts). Shows last 8 sales. |
| `Inventario` | Tabbed UI: Lista / Agregar / Fotos. Card grid with carousel. Inline edit via Modal. CSV export via `exportCSV`. Photo upload via `uploadFile`. |
| `Clientes` | Search/filter by nombre, apellido, DNI. CRUD via inline form + Modal. |
| `Ventas` | Create/edit sales. Selects producto and cliente from API. Handles `monto_permuta`. |
| `Compras` | CRUD for purchase records. Links proveedor + producto. |
| `Proveedores` | Basic CRUD. |
| `Permutas` | CRUD for trade-in records. Optional link to venta and cliente. |
| `Catalogo` | Public page. Fetches `GET /productos/public`. No auth. Shows disponible products only. |

### Shared Components

| Component | Description |
|---|---|
| `Layout` | Sticky top nav with NavLinks + logout button. Calls `POST /auth/logout` then clears `loggedIn`. |
| `Button` | Variants: `primary`, `secondary`, `danger`. Accepts `disabled`. |
| `Input` | Labelled input with optional error state. |
| `Select` | Labelled `<select>` wrapper. Accepts `options: {value, label}[]`. |
| `Textarea` | Labelled textarea. |
| `Modal` | Radix Dialog wrapper. Props: `isOpen`, `onClose`, `title`. |
| `Carousel` | Image carousel for product photos. Props: `urls: string[]`, `height: number`. |
| `StatusBadge` | Colored pill badge. Handles: `disponible`, `reservado`, `vendido`, `nuevo`, `usado`, `reacondicionado`, `bueno`, `regular`, `malo`, payment methods. |
| `ErrorMessage` | Red alert box. |
| `SuccessMessage` | Green alert box. |

---

## 10. Patterns and Conventions

### Backend
- All router functions are `async`. DB access uses `await db.execute(...)`, `await db.get(...)`.
- Pydantic schemas use `ConfigDict(from_attributes=True)` on response models to allow ORM → schema conversion.
- `model_dump(exclude_unset=True)` is used on `Update` schemas so PATCH-style partial updates work via `PUT`.
- Foreign key integrity errors (delete blocked by relations) are handled by checking counts before deletion, not by catching DB exceptions.
- The `verify_token` dependency returns the username string (`str`) and is typed as `_: str = Depends(verify_token)` on most routes (result unused — only the cookie validation matters).

### Frontend
- All API calls use the `api.*` helpers or `uploadFile()` from `api.ts`.
- Errors are surfaced via `toast.error(e.message)` (sonner).
- Loading states use a local `loading` boolean with skeleton UIs.
- Decimal values from the API arrive as strings (Pydantic serializes `Decimal` as string). `parseDecimal()` from `api.ts` converts them.
- `exportCSV()` from `lib/utils.ts` handles CSV export client-side.
- The brand color is `#2563EB` (Tailwind `blue-600`), used as a CSS literal throughout.

---

## 11. Business Rules Encoded in Code

1. A product in `estado = "vendido"` cannot be deleted.
2. Creating a `Venta` sets the linked `Producto.estado` to `"vendido"` in the same DB commit.
3. A `Cliente` with associated ventas cannot be deleted.
4. A `Proveedor` with associated compras cannot be deleted.
5. A `Venta` can only be created for a product with `estado = "disponible"`.
6. Updating a venta does **not** revert the producto's estado (no rollback logic).
7. Photo deletion removes only the DB record — the file in Supabase Storage is not deleted.
8. Upload validation: only JPEG, PNG, and WebP are accepted (magic bytes check). Max size is `MAX_UPLOAD_MB` (default 10 MB).

---

## 12. Known Gaps / Refactoring Opportunities

- **No Alembic migrations** — schema changes must be applied manually in Supabase.
- **No soft delete** — records are hard-deleted.
- **Deleting a foto doesn't delete the file from Supabase Storage** — orphaned files accumulate.
- **Dashboard KPIs are computed client-side** from full ventas + productos lists — will become slow at scale.
- **No pagination** — all list endpoints return every row. High-volume tables (ventas, compras) will become a problem.
- **No tests** — pytest and pytest-asyncio are in requirements.txt but no test files exist.
- **`as any` casts in frontend** — several places cast to `any` when passing enum values to `StatusBadge`.
- **`venta.PUT` doesn't revert producto estado** — updating a venta's `producto_id` would leave the old product stuck as "vendido".
- **Models use plain `str` for enum columns** — the SQLAlchemy models don't use `Enum` column types, so invalid values can be written directly via raw SQL.
