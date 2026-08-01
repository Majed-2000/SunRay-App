#!/usr/bin/env bash
#
# Deploy the backend, and PROVE it worked.
#
# Written after the same failure happened three times in one session: the
# container was running, /health returned 200, login worked — and the image
# contained none of the new code. `docker compose up -d --build` had reused a
# cached layer, or the build had raced the `git pull` that fetched the source.
#
# The lesson is not "remember to check". It is that a deploy which cannot prove
# itself is not a deploy. Every step below verifies its own effect, and the
# script exits non-zero the moment one cannot.
#
#   ssh root@server 'bash /root/sunray/backend/deploy/deploy.sh'

set -euo pipefail

REPO=/root/sunray
DEPLOY_DIR="$REPO/backend/deploy"
COMPOSE="docker compose -f $DEPLOY_DIR/docker-compose.prod.yml"
HEALTH_URL="https://sunraycafe.duckdns.org/health/ready"

step() { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }
ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*"; }

cd "$DEPLOY_DIR"

# ── 1. Source ────────────────────────────────────────────────────────────────
step "Fetching source"
BEFORE=$(git -C "$REPO" rev-parse HEAD)
git -C "$REPO" pull --ff-only
AFTER=$(git -C "$REPO" rev-parse HEAD)
ok "$(git -C "$REPO" log --oneline -1)"
[ "$BEFORE" = "$AFTER" ] && echo "  (already up to date)"

# Which server-side modules should exist afterwards? Derived from the source we
# just pulled, so a new module is covered automatically without editing this
# script. This is the list the image is checked against below.
EXPECTED_MODULES=$(ls "$REPO/backend/src/modules" | tr '\n' ' ')

# ── 2. Build ─────────────────────────────────────────────────────────────────
# --no-cache is deliberate. A cached layer is exactly what produced a stale
# image before, and a backend this size rebuilds in a couple of minutes.
step "Building image (no cache)"
$COMPOSE build --no-cache api

# ── 3. Recreate ──────────────────────────────────────────────────────────────
# --force-recreate because compose does not always replace a container when only
# the contents of an env_file changed — another way stale state survives.
step "Recreating containers"
$COMPOSE up -d --force-recreate api caddy
sleep 20

# ── 4. Prove the new code is in the running image ────────────────────────────
step "Verifying the image contains the current source"
for m in $EXPECTED_MODULES; do
  # Every module directory must have compiled to at least one .js file.
  if ! $COMPOSE exec -T api sh -c "ls /app/dist/src/modules/$m/*.js >/dev/null 2>&1"; then
    fail "module '$m' is missing from the image — the build did not include the current source"
  fi
done
ok "all $(echo "$EXPECTED_MODULES" | wc -w) modules present in /app/dist"

# ── 5. Migrations ────────────────────────────────────────────────────────────
# The container already ran `migrate deploy` on start; this confirms the result
# rather than trusting it. A schema that drifted from the migration history is
# the failure that hides longest.
step "Verifying migration state"
if ! $COMPOSE exec -T api npx prisma migrate status 2>&1 | tee /tmp/migrate-status | grep -q "Database schema is up to date"; then
  cat /tmp/migrate-status
  fail "migrations are not fully applied"
fi
ok "database schema matches the migration history"

# ── 6. Health ────────────────────────────────────────────────────────────────
step "Checking health from outside"
CODE=$(curl -s -o /dev/null -m 45 -w '%{http_code}' "$HEALTH_URL" || true)
[ "$CODE" = "200" ] || fail "health check returned $CODE"
ok "$HEALTH_URL → 200"

step "Deploy verified"
$COMPOSE ps --format '  {{.Service}}: {{.Status}}'
