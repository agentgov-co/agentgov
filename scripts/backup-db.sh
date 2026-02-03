#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# AgentGov — PostgreSQL Backup Script
# ============================================================================
# Features:
#   - pg_dump with gzip compression
#   - Optional GPG encryption (symmetric)
#   - Optional S3 upload via AWS CLI
#   - SHA-256 checksum for integrity verification
#   - Configurable retention with automatic rotation
#
# Usage:
#   ./scripts/backup-db.sh
#
# Environment variables (required):
#   DATABASE_URL          — PostgreSQL connection string
#
# Environment variables (optional):
#   BACKUP_DIR            — Local backup directory (default: /var/backups/agentgov)
#   RETENTION_DAYS        — Days to keep local backups (default: 30)
#   BACKUP_ENCRYPTION_KEY — GPG passphrase for encryption (skip if empty)
#   BACKUP_S3_BUCKET      — S3 bucket for remote upload (skip if empty)
#   BACKUP_S3_PREFIX      — S3 key prefix (default: backups/)
#
# Recommended cron (daily at 3 AM UTC):
#   0 3 * * * /path/to/scripts/backup-db.sh >> /var/log/agentgov-backup.log 2>&1
# ============================================================================

BACKUP_DIR="${BACKUP_DIR:-/var/backups/agentgov}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/agentgov_${TIMESTAMP}.sql.gz"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }
fail() { log "ERROR: $*" >&2; exit 1; }

# ---- Pre-flight checks ----
[ -z "${DATABASE_URL:-}" ] && fail "DATABASE_URL is not set"
command -v pg_dump &>/dev/null || fail "pg_dump is not installed"

if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  command -v aws &>/dev/null || fail "aws CLI is required for S3 upload but not installed"
fi

if [ -n "${BACKUP_ENCRYPTION_KEY:-}" ]; then
  command -v gpg &>/dev/null || fail "gpg is required for encryption but not installed"
fi

mkdir -p "${BACKUP_DIR}"

# ---- Dump + compress ----
log "Starting backup..."
pg_dump --no-owner --no-privileges "${DATABASE_URL}" | gzip > "${BACKUP_FILE}"

[ ! -s "${BACKUP_FILE}" ] && { rm -f "${BACKUP_FILE}"; fail "Backup file is empty"; }

# ---- Encrypt (optional) ----
if [ -n "${BACKUP_ENCRYPTION_KEY:-}" ]; then
  log "Encrypting backup with GPG..."
  gpg --batch --yes --symmetric --cipher-algo AES256 \
      --passphrase "${BACKUP_ENCRYPTION_KEY}" \
      --output "${BACKUP_FILE}.gpg" \
      "${BACKUP_FILE}"
  rm -f "${BACKUP_FILE}"
  BACKUP_FILE="${BACKUP_FILE}.gpg"
  log "Encryption complete"
fi

# ---- SHA-256 checksum ----
CHECKSUM=$(shasum -a 256 "${BACKUP_FILE}" | cut -d' ' -f1)
echo "${CHECKSUM}  $(basename "${BACKUP_FILE}")" > "${BACKUP_FILE}.sha256"

BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
log "Backup complete: ${BACKUP_FILE} (${BACKUP_SIZE}, sha256:${CHECKSUM:0:16}...)"

# ---- S3 upload (optional) ----
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  S3_PREFIX="${BACKUP_S3_PREFIX:-backups/}"
  S3_PATH="s3://${BACKUP_S3_BUCKET}/${S3_PREFIX}$(basename "${BACKUP_FILE}")"

  log "Uploading to ${S3_PATH}..."
  aws s3 cp "${BACKUP_FILE}" "${S3_PATH}" --storage-class STANDARD_IA
  aws s3 cp "${BACKUP_FILE}.sha256" "${S3_PATH}.sha256" --storage-class STANDARD_IA
  log "S3 upload complete"
fi

# ---- Rotate old local backups ----
DELETED=$(find "${BACKUP_DIR}" -name "agentgov_*.sql.gz*" -mtime "+${RETENTION_DAYS}" -print -delete | wc -l | tr -d ' ')
if [ "${DELETED}" -gt 0 ]; then
  log "Rotated ${DELETED} file(s) older than ${RETENTION_DAYS} days"
fi

log "Done"
