# Deploying the Sun Ray Backend Globally

This makes the backend reachable on a public HTTPS URL so the app works from any
network — no Tailscale/LAN needed. It does **not** change local dev (SQLite +
`npm run dev` keep working unchanged).

## ⚠️ Read first — mock OTP
The OTP is still **mock**: any 4-digit code logs in as any phone number. Hosting
publicly as-is means **anyone can log in as anyone**. Fine for a **private demo/
beta**; before real users, wire a real SMS/OTP provider (Twilio / Unifonic /
Msegat) and real payments. Everything else (auth tokens, sessions, IDOR guards,
rate limits, validation) is real — see `SECURITY.md`.

## Database: SQLite (dev) vs PostgreSQL (prod)
SQLite is single-file, dev-only. **Production uses PostgreSQL.** Prisma fixes the
provider in `schema.prisma`, and the SQLite migrations don't apply to Postgres, so
the production build:
1. runs `scripts/use-postgres.mjs postgresql` to flip the datasource to Postgres
   (only on the build copy — your committed schema stays SQLite), then
2. `prisma generate` (Postgres client) + `prisma db push` to create the schema.

The data models are identical; this just targets a different engine.

---

## Option A — Render (recommended, ~10 min)
A managed host that gives HTTPS + a public URL + managed Postgres from the
committed `render.yaml` blueprint.

1. Push this repo to GitHub (ask me — I won't push without your go-ahead).
2. Render → **New → Blueprint** → pick the repo. It reads `render.yaml`, creates
   `sunray-db` (Postgres) and `sunray-backend` (web service), and wires
   `DATABASE_URL` + a generated `JWT_ACCESS_SECRET` automatically.
3. Wait for the deploy, then verify:
   ```
   curl https://sunray-backend.onrender.com/health        # {ok:true,...}
   curl https://sunray-backend.onrender.com/health/ready  # DB reachable
   ```
4. (Optional) seed the catalog so the menu isn't empty — Render shell:
   `node scripts/use-postgres.mjs postgresql && npx prisma db seed`
5. Point the app at it: in the project root `.env`
   ```
   EXPO_PUBLIC_API_BASE_URL=https://sunray-backend.onrender.com
   EXPO_PUBLIC_USE_BACKEND=true
   ```
   Rebuild the app (`npx expo start -c`, or an EAS build) and it works globally.

> Other managed hosts (Railway, Fly.io) work the same way — provision Postgres,
> set the env vars below, build with the buildCommand, start with the startCommand.

## Option B — Docker (any host / VPS)
The `Dockerfile` produces a production image targeting Postgres.

```
cd backend
docker build -t sunray-backend .
docker run -p 4000:4000 \
  -e NODE_ENV=production \
  -e DATABASE_URL='postgresql://USER:PASS@HOST:5432/sunray?sslmode=require' \
  -e JWT_ACCESS_SECRET='<64 random bytes>' \
  -e TRUST_PROXY=1 \
  sunray-backend
```
Put it behind a TLS terminator (the platform's LB, Caddy, or Cloudflare) so the
public URL is HTTPS. Set `TRUST_PROXY` to the number of proxies in front (usually 1).

### Test the Postgres path locally first
```
cd backend
docker compose up --build        # starts Postgres + the API image
curl http://localhost:4000/health/ready
```
This validates the exact production config without touching your SQLite dev DB.

---

## Required production env (see `.env.production.example`)
| Var | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `postgresql://…` (with `sslmode=require` for managed PG) |
| `JWT_ACCESS_SECRET` | strong random (the server refuses the dev default in prod) |
| `TRUST_PROXY` | `1` behind one proxy/LB |
| `ADMIN_ENABLED` | `false` |
| `CORS_ORIGINS` | leave empty for the mobile app; set web origins if you add a browser client |
| `BODY_LIMIT` | `100kb` |

Generate a secret: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`

## Ongoing schema changes
First deploy uses `prisma db push` (creates tables from the schema). For later
changes in production, generate proper Postgres migrations and run
`prisma migrate deploy` as a release step instead of `db push`.

## Scaling notes
Rate limiting and the catalog cache are in-memory (per instance). Before running
more than one instance, move rate limiting to Redis (`rate-limit-redis`) and run
schema changes as a one-off release step, not on every container start. See
`docs/SECURITY_HARDENING_NOTES.md`.
