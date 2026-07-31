#!/usr/bin/env bash
#
# Nightly PostgreSQL backup with rotation.
#
# Install as a cron job on the server:
#   chmod +x ~/sunray/backend/deploy/backup.sh
#   mkdir -p ~/backups
#   crontab -e
#   # then add (runs 03:15 server time). cron does NOT expand ~, so use the
#   # absolute path — /root/... on LightNode, /home/ubuntu/... on Oracle:
#   15 3 * * * /root/sunray/backend/deploy/backup.sh >> /root/backups/backup.log 2>&1
#
# ⚠  These dumps live on the SAME server as the database. If the instance is
#    lost or terminated, the backups go with it. Copy them off-box — see
#    "Offsite copies" at the bottom of this file.

set -euo pipefail

STACK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%F-%H%M)"
OUT="$BACKUP_DIR/sunray-$STAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date -Is)] starting backup → $OUT"

# -T disables the TTY, which cron does not provide.
# The pipeline is set -o pipefail'd, so a failing pg_dump fails the script
# instead of silently writing a valid-looking empty gzip.
docker compose -f "$STACK_DIR/docker-compose.prod.yml" exec -T db \
  pg_dump -U sunray -d sunray --clean --if-exists \
  | gzip -9 > "$OUT"

# A healthy dump of this schema is comfortably over 1 KB even when nearly
# empty. Anything smaller means the dump failed — delete it so it can't be
# mistaken for a good restore point.
SIZE=$(stat -c%s "$OUT")
if [ "$SIZE" -lt 1024 ]; then
  echo "[$(date -Is)] ERROR: dump is only ${SIZE} bytes — deleting" >&2
  rm -f "$OUT"
  exit 1
fi

echo "[$(date -Is)] wrote $OUT (${SIZE} bytes)"

# Rotate
DELETED=$(find "$BACKUP_DIR" -name 'sunray-*.sql.gz' -mtime "+$KEEP_DAYS" -print -delete | wc -l)
echo "[$(date -Is)] rotated out $DELETED backup(s) older than $KEEP_DAYS days"

# ── Restoring ────────────────────────────────────────────────────────────────
#   gunzip -c ~/backups/sunray-2026-07-31-0315.sql.gz \
#     | docker compose -f docker-compose.prod.yml exec -T db psql -U sunray -d sunray
#
# ── Offsite copies ───────────────────────────────────────────────────────────
# Pick one and add it to the cron line above:
#   rclone copy "$BACKUP_DIR" remote:sunray-backups   # Google Drive, S3, B2…
#   scp "$OUT" you@another-host:/backups/
# Then actually test a restore. An untested backup is not a backup.
