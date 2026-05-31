#!/usr/bin/env bash
set -euo pipefail
# Конфиг через env: POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, BACKUP_DIR
# По умолчанию использует значения из docker-compose
BACKUP_DIR="${BACKUP_DIR:-./backups}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-portal}"
POSTGRES_DB="${POSTGRES_DB:-learning_portal}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="${POSTGRES_DB}_${TIMESTAMP}.sql.gz"
mkdir -p "$BACKUP_DIR"
# Дамп через docker exec (если запущено в compose) или прямой pg_dump
if docker ps --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER}$"; then
  echo "→ Dumping from container ${POSTGRES_CONTAINER}..."
  docker exec -t "$POSTGRES_CONTAINER" pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "${BACKUP_DIR}/${FILENAME}"
else
  echo "→ Container ${POSTGRES_CONTAINER} not running, trying direct pg_dump..."
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > "${BACKUP_DIR}/${FILENAME}"
fi
echo "✓ Backup saved: ${BACKUP_DIR}/${FILENAME}"
# Ротация: оставить последние 14
ls -1t "${BACKUP_DIR}"/*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm -v
