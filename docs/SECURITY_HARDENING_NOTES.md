# Security Hardening — What Changed & What Remains

Phase: backend security, reliability, and production-readiness hardening.
Out of scope (intentionally NOT done): Foodics integration, real payments, real
SMS/OTP. Mock mode (`EXPO_PUBLIC_USE_BACKEND=false`) is unchanged.

## What was hardened

1. **Security middleware** — Helmet, configurable CORS allowlist, JSON body-size
   limit, `trust proxy`, and IP-based rate limiting. App refactored into an
   importable `app.ts` (for tests) + `server.ts` (listen + graceful shutdown).
2. **Real auth/session model** — access JWT (15m) + rotating opaque refresh token
   (30d) stored as a sha256 hash in a new `Session` table. New endpoints:
   `refresh`, `logout`, `me`. Logout/expiry invalidate the session immediately
   (per-request session check).
3. **Authorization / IDOR** — identity is derived from the token, never from the
   client. Ownership guard on `/customers/:id/*`; orders & gift-cards derive the
   customer from the token; cross-customer reads return 403/404.
4. **Validation & errors** — Zod on bodies + id params; centralized error handler
   emits a consistent envelope for 401/403/404/409/422/429/500; Prisma errors
   mapped; no stack-trace leaks.
5. **App token handling** — SecureStore-backed refresh token, in-memory access
   token, automatic attach + 401→refresh→retry-once, 15s request timeout,
   session restore on app start, graceful session-expiry → login (cart preserved).
6. **Reliability** — bounded TTL catalog cache; memory-leak audit (all app timers
   clean up; backend cache sweeper is `unref`'d and stopped on shutdown);
   store-level double-submit guard for orders.
7. **Tests** — vitest + supertest covering auth, IDOR, validation, and rate limit
   (16 tests).

## Auth/session model (summary)

```
login → verify → { accessToken(JWT 15m), refreshToken(opaque 30d), customer }
  every request: Authorization: Bearer <access>
  401 → POST /auth/refresh { refreshToken } → new access (+ rotated refresh) → retry
  logout → revoke session (access + refresh both die immediately)
```

The app stores the refresh token in **expo-secure-store** (device keychain), the
access token in memory only. On cold start it restores the session via the refresh
token + `GET /auth/me`.

## Exposed-secrets audit

`git ls-files | grep -iE '\.env|\.db'` → only `.env.example` / `backend/.env.example`
are tracked. No real `.env`, no `*.db`, no hardcoded tokens/keys/passwords found in
app or backend source. `.gitignore` covers `.env*` and `*.db`. No redaction was
necessary (nothing exposed).

## Known limitations (acceptable for this phase)

- **OTP is mocked** — any 4-digit code verifies. No SMS provider.
- **Payments are cosmetic** — checkout never claims a real payment; backend saves
  orders as `PENDING` (pay-at-branch). In backend mode the app hides coupon/points/
  wallet perks and shows the server-aligned total (server forces `discount=0`).
- **SQLite in dev** — no DB-level auth; single file (gitignored).
- **In-memory rate limiting & cache** — per-process; reset on restart.
- **Refresh reuse detection is basic** — rotation only (no token-family auto-revoke).

## Remaining production TODOs

- PostgreSQL with authenticated credentials + TLS (see `.env.production.example`).
- Redis-backed rate limiting and (optionally) refresh/session + cache storage.
- Real OTP/SMS provider; device tracking; refresh-token *family* theft detection.
- HTTPS/TLS termination; set `TRUST_PROXY` to the real proxy hop count.
- Tighten `CORS_ORIGINS` to known web origins.
- Consider httpOnly cookies if a web client is added (mobile uses Bearer + SecureStore).

## Project note (discrepancy found)

`AGENTS.md` says to target **Expo SDK v56**, but the installed project is **Expo SDK
54** (`expo: ~54.0.0`, `expo-secure-store: ~15.0.8`). All app code here was written
against the installed SDK 54 (the SecureStore API used —
`getItemAsync`/`setItemAsync`/`deleteItemAsync` — is identical across 54–56). Worth
reconciling `AGENTS.md` with the actual SDK.
