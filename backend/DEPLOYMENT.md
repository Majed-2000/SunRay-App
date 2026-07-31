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
4. **Seed the catalog (required, once).** `db push` creates empty tables, so the
   menu/branches screens are blank until you seed. In the Render **Shell**, run:
   ```
   npx prisma db seed
   ```
   ⚠️ Run this **only once** — `seed.ts` is destructive (it `deleteMany`s before
   inserting), so re-running wipes any real orders/customers. Never put it in the
   start command.
5. Point the app at it: in the project root `.env`
   ```
   EXPO_PUBLIC_API_BASE_URL=https://sunray-backend.onrender.com
   EXPO_PUBLIC_USE_BACKEND=true
   ```
   Rebuild the app (`npx expo start -c`, or an EAS build) and it works globally.

> **Free-tier cold starts:** a free Render service sleeps after ~15 min idle and
> takes 30–50s to wake. The app uses a 60s request timeout and pings `/health` at
> launch to warm it, so the first login works — it may just be slow the first time.
> Override the timeout with `EXPO_PUBLIC_REQUEST_TIMEOUT_MS` if needed.

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

## Option C — VPS in Saudi Arabia (in-Kingdom hosting) ← current setup
**The path to use for anything with real Saudi customers.** Puts the backend on
a VPS inside Saudi Arabia (LightNode Riyadh; Oracle Cloud's free Jeddah tier
documented as an appendix), with Caddy for automatic HTTPS, Postgres in Docker,
and nightly backups. Data stays in-Kingdom (PDPL) and there are no free-tier cold
starts. Serves `https://api.sunray.sa`.

Everything lives in [`deploy/`](deploy/):

| File | Purpose |
|------|---------|
| `SAUDI_VPS.md` | **Start here** — full step-by-step walkthrough |
| `docker-compose.prod.yml` | Caddy + API + Postgres (Postgres is not published) |
| `Caddyfile` | Reverse proxy + automatic Let's Encrypt TLS |
| `prod.env.example` | Production secrets template → copy to `deploy/.env` |
| `provision.sh` | One-time server setup (Docker, ufw, auto security updates) |
| `backup.sh` | Nightly `pg_dump` with rotation + restore instructions |

```
# on the server, after provision.sh
cd ~/sunray/backend/deploy
cp prod.env.example .env && nano .env
docker compose -f docker-compose.prod.yml up -d --build
```

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
