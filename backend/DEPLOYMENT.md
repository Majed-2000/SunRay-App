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

## Option A — Render — ❌ retired (kept as history)
We deployed here first. The free tier expired and the service is gone;
`render.yaml` has been deleted. **Do not resurrect this path** — the data would
sit outside Saudi Arabia, which is the opposite of what Option C is for.

Two things it left behind, both since fixed — worth knowing if you see traces:

- The rate limiter trusted the `CF-Connecting-IP` header, which was correct only
  because Cloudflare fronted every Render service and overwrote it. Behind our own
  Caddy, nothing strips that header, so trusting it let any client rotate a fake
  value per request and bypass every rate limit — including brute-force protection
  on login. `rateLimit.ts` now keys on `req.ip` via `TRUST_PROXY`.
- Free-tier cold starts (30–50s) are why the app has a 60s request timeout and a
  `/health` ping at launch. Harmless now, and still useful on a slow network.

Other managed hosts (Railway, Fly.io) would work the same way — provision Postgres,
set the env vars below, build with the buildCommand, start with the startCommand.

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
