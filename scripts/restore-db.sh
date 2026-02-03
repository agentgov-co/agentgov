#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# AgentGov — PostgreSQL Restore Script
# ============================================================================
# Restores a backup created by backup-db.sh.
# Supports: gzip, GPG-encrypted, local files, and S3 sources.
#
# Usage:
#   ./scripts/restore-db.sh <backup-file-or-s3-path>
#
# Examples:
#   ./scripts/restore-db.sh /var/backups/agentgov/agentgov_20260203_030000.sql.gz
#   ./scripts/restore-db.sh /var/backups/agentgov/agentgov_20260203_030000.sql.gz.gpg
#   ./scripts/restore-db.sh s3://my-bucket/backups/agentgov_20260203_030000.sql.gz
#
# Environment variables (required):
#   DATABASE_URL              — Target PostgreSQL connection string
#
# Environment variables (optional):
#   BACKUP_ENCRYPTION_KEY     — GPG passphrase (required for .gpg files)
#   RESTORE_DRY_RUN           — Set to "true" to verify backup without restoring
# ============================================================================

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }
fail() { log "ERROR: $*" >&2; exit 1; }

# ---- Args ----
BACKUP_SOURCE="${1:-}"
[ -z "${BACKUP_SOURCE}" ] && fail "Usage: $0 <backup-file-or-s3-path>"
[ -z "${DATABASE_URL:-}" ] && fail "DATABASE_URL is not set"
command -v psql &>/dev/null || fail "psql is not installed"

DRY_RUN="${RESTORE_DRY_RUN:-false}"
WORK_DIR=$(mktemp -d)
trap 'rm -rf "${WORK_DIR}"' EXIT

# ---- Download from S3 if needed ----
if [[ "${BACKUP_SOURCE}" == s3://* ]]; then
  command -v aws &>/dev/null || fail "aws CLI is required for S3 download but not installed"
  LOCAL_FILE="${WORK_DIR}/$(basename "${BACKUP_SOURCE}")"

  log "Downloading from ${BACKUP_SOURCE}..."
  aws s3 cp "${BACKUP_SOURCE}" "${LOCAL_FILE}"

  # Download checksum if available
  if aws s3 ls "${BACKUP_SOURCE}.sha256" &>/dev/null; then
    aws s3 cp "${BACKUP_SOURCE}.sha256" "${LOCAL_FILE}.sha256"
  fi
else
  LOCAL_FILE="${BACKUP_SOURCE}"
fi

[ ! -f "${LOCAL_FILE}" ] && fail "Backup file not found: ${LOCAL_FILE}"

# ---- Verify checksum ----
if [ -f "${LOCAL_FILE}.sha256" ]; then
  log "Verifying SHA-256 checksum..."
  EXPECTED=$(cut -d' ' -f1 "${LOCAL_FILE}.sha256")
  ACTUAL=$(shasum -a 256 "${LOCAL_FILE}" | cut -d' ' -f1)
  if [ "${EXPECTED}" != "${ACTUAL}" ]; then
    fail "Checksum mismatch! Expected ${EXPECTED}, got ${ACTUAL}. Backup may be corrupted."
  fi
  log "Checksum verified"
else
  log "WARNING: No checksum file found — skipping integrity verification"
fi

# ---- Decrypt if GPG-encrypted ----
SQL_FILE="${LOCAL_FILE}"
if [[ "${LOCAL_FILE}" == *.gpg ]]; then
  [ -z "${BACKUP_ENCRYPTION_KEY:-}" ] && fail "BACKUP_ENCRYPTION_KEY is required for encrypted backups"
  command -v gpg &>/dev/null || fail "gpg is required for decryption but not installed"

  DECRYPTED="${WORK_DIR}/$(basename "${LOCAL_FILE}" .gpg)"
  log "Decrypting backup..."
  gpg --batch --yes --decrypt \
      --passphrase "${BACKUP_ENCRYPTION_KEY}" \
      --output "${DECRYPTED}" \
      "${LOCAL_FILE}"
  SQL_FILE="${DECRYPTED}"
  log "Decryption complete"
fi

# ---- Dry run: verify backup is readable ----
if [ "${DRY_RUN}" = "true" ]; then
  log "DRY RUN — verifying backup is readable..."
  if [[ "${SQL_FILE}" == *.gz ]]; then
    LINE_COUNT=$(gunzip -c "${SQL_FILE}" | head -100 | wc -l | tr -d ' ')
  else
    LINE_COUNT=$(head -100 "${SQL_FILE}" | wc -l | tr -d ' ')
  fi
  log "DRY RUN — backup is valid (sampled ${LINE_COUNT} lines). No changes made."
  exit 0
fi

# ---- Safety confirmation ----
DB_NAME=$(echo "${DATABASE_URL}" | sed -E 's|.*/([^?]+).*|\1|')
log "WARNING: This will overwrite database '${DB_NAME}'"
log "Press Ctrl+C within 5 seconds to abort..."
sleep 5

# ---- Restore ----
log "Starting restore..."
if [[ "${SQL_FILE}" == *.gz ]]; then
  gunzip -c "${SQL_FILE}" | psql "${DATABASE_URL}" --single-transaction --set ON_ERROR_STOP=on
else
  psql "${DATABASE_URL}" --single-transaction --set ON_ERROR_STOP=on < "${SQL_FILE}"
fi

log "Restore complete"
