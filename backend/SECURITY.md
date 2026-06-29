# Sun Ray Backend — Security Model

This document describes how the backend protects data after the security-hardening
pass. It is development-grade-real: the auth/session/authorization machinery is
real, but OTP delivery is still mocked (any 4-digit code works) and there is no
real payment or Foodics integration yet.

## Authentication & sessions

- **Access token** — a short-lived (default **15m**) HS256 JWT carrying `sub`
  (customerId) and `sid` (sessionId). Verified on every protected request.
- **Refresh token** — a long-lived (default **30d**) opaque random secret
  (`crypto.randomBytes(32)`). Only its **sha256 hash** is stored in the `Session`
  table; the raw token is returned to the client once and never logged.
- **Session table** — every login creates a `Session` row. The `authenticate`
  middleware checks the session is present, not revoked, and not expired on every
  request, so **logout and expiry take effect immediately** (not after the JWT's
  15-minute lifetime).

### Endpoints
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/auth/login` | public (rate-limited) | mock OTP request |
| POST | `/api/auth/verify` | public (rate-limited) | verify OTP → `{ accessToken, refreshToken, expiresIn, customer }` |
| POST | `/api/auth/refresh` | public (rate-limited) | rotate refresh token → new access |
| POST | `/api/auth/logout` | access token | revoke the current session |
| GET | `/api/auth/me` | access token | current customer |

### Refresh rotation & reuse
Refreshing **rotates** the refresh token (the session row's hash is replaced). A
previously-used refresh token therefore no longer matches any session and is
rejected with 401. Logout sets `revokedAt`, killing both the refresh token and the
per-request access check.

> Production TODO: add a refresh-token *family* id to auto-revoke a whole chain if
> a rotated token is replayed (stronger theft detection), plus device tracking.

## Authorization & IDOR prevention

Identity is **derived from the token, never trusted from the client**:

- Customer-scoped routes `/api/customers/:id/...` are guarded by `requireSelfParam`
  — the `:id` must equal the authenticated customerId, else **403**.
- `POST /api/orders` ignores any `customerId`/`discount` in the body; the owner is
  the token's customer and `discount` is forced to `0` (discounts must be
  authorized server-side once coupons exist).
- `GET /api/orders` is scoped to the token's customer; `GET /api/orders/:id`
  returns **404** (not 403) for someone else's order so existence isn't leaked.
- Gift-card issue uses the token as sender; redeem credits the token's customer.
- `PATCH /api/orders/:id/status` is a dev/admin endpoint: requires auth **and**
  `requireDev` (allowed only when `NODE_ENV!=='production'` or `ADMIN_ENABLED=true`,
  otherwise hidden as 404).

## Input validation

All bodies are validated with Zod; id path params use a cuid-ish `idParam`. Invalid
input returns **422** with `{ code: 'VALIDATION_ERROR', details }`. Validation does
not replace authorization — both run.

## SQL injection

All database access goes through Prisma (parameterized queries); there is **no raw
SQL** in the codebase. This makes classic SQL injection effectively impossible, but
input validation is still required to reject malformed shapes and enforce limits.

## HTTP hardening

- `helmet()` security headers (and `X-Powered-By` removed).
- CORS allowlist via `CORS_ORIGINS` (permissive only when empty, for dev).
- JSON body size limit (`BODY_LIMIT`, default `100kb`).
- `trust proxy` configurable (`TRUST_PROXY`) so client IPs are correct behind a proxy.
- Centralized error handler → consistent `{ ok:false, error:{ code, message, details? } }`
  for 401/403/404/409/422/429/500. Stack traces are never leaked; known Prisma
  errors are mapped (P2025→404, P2002→409).

## Rate limiting (IP-based, in-memory)

| Limiter | Scope | Limit |
|---------|-------|-------|
| general | `/api/*` | ~1000 / 15m |
| auth | login/verify/refresh | ~10 / 15m |
| gift redeem | `/gift-cards/redeem` | ~10 / hour |
| order create | `POST /orders` | ~30 / 10m |
| dev | `PATCH /orders/:id/status` | strict |

429 responses use the standard envelope (`RATE_LIMITED`).

> Production TODO: the in-memory store resets on restart and isn't shared across
> instances — use a Redis-backed store (`rate-limit-redis`) before scaling out, and
> set `TRUST_PROXY` to the exact proxy hop count so `X-Forwarded-For` can't be spoofed.

## Database authentication (SQLite vs PostgreSQL)

- **SQLite (dev)** has **no username/password authentication** — it's a single
  file. Security relies on filesystem permissions. `dev.db`/`test.db` are
  gitignored and must never be exposed publicly or used in production.
- **PostgreSQL (production)** must be used with authenticated credentials, network
  isolation, and TLS (`sslmode=require`). See `.env.production.example`. The Prisma
  models are unchanged; only the datasource provider + `DATABASE_URL` differ.

## Caching

Public catalog reads (`/menu`, `/products/:id`, `/branches`) use a small bounded
in-memory TTL cache (60s). Customer-scoped data is **never** cached. Call
`invalidateCatalog()` after any future catalog mutation. Production can move this to
Redis for cross-instance consistency.

## Secrets

No secrets are committed: `git ls-files` tracks only `.env.example` files (no real
`.env`, no `*.db`). `EXPO_PUBLIC_*` values are bundled into the app, so no secret
may ever be placed there — all secrets stay on the backend.
