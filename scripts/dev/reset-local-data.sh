#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PRESERVE_ML_CACHE="${PRESERVE_ML_CACHE:-1}"

if [[ "${CONFIRM_RESET:-}" != "1" ]]; then
  echo "Refusing to reset local data without CONFIRM_RESET=1" >&2
  echo "Example: CONFIRM_RESET=1 PRESERVE_ML_CACHE=1 scripts/dev/reset-local-data.sh" >&2
  exit 1
fi

cd "$ROOT_DIR"

docker compose -f docker-compose.yml -f docker-compose.local-build.yml down --remove-orphans

if [[ "$PRESERVE_ML_CACHE" == "1" ]]; then
  ML_CACHE_TMP="$(mktemp -d)"
  if [[ -d "$ROOT_DIR/data/ai/models" ]]; then
    mkdir -p "$ML_CACHE_TMP"
    cp -a "$ROOT_DIR/data/ai/models" "$ML_CACHE_TMP/models"
  fi
  if [[ -d "$ROOT_DIR/data/ai/localai/models" ]]; then
    mkdir -p "$ML_CACHE_TMP/localai"
    cp -a "$ROOT_DIR/data/ai/localai/models" "$ML_CACHE_TMP/localai/models"
  fi
fi

rm -rf "$ROOT_DIR/data/storage"
rm -rf "$ROOT_DIR/data/app"
rm -rf "$ROOT_DIR/data/app.sqlite3"
rm -rf "$ROOT_DIR/data/app.sqlite3-shm"
rm -rf "$ROOT_DIR/data/app.sqlite3-wal"
rm -rf "$ROOT_DIR/data/logs"
rm -rf "$ROOT_DIR/data/middleware"
rm -rf "$ROOT_DIR/data/ai/qdrant"
rm -rf "$ROOT_DIR/data/ai/infinity"
rm -rf "$ROOT_DIR/data/ai/models"
rm -rf "$ROOT_DIR/data/ai/localai/backend_data"
rm -rf "$ROOT_DIR/data/ai/localai/cache"
rm -rf "$ROOT_DIR/data/ai/localai/models"
rm -rf "$ROOT_DIR/third-party/middleware/data/middleware"

mkdir -p "$ROOT_DIR/data/ai/models"
if [[ "${PRESERVE_ML_CACHE:-1}" == "1" && -d "${ML_CACHE_TMP:-}/models" ]]; then
  cp -a "$ML_CACHE_TMP/models/." "$ROOT_DIR/data/ai/models/"
fi
mkdir -p "$ROOT_DIR/data/ai/localai/models"
if [[ "${PRESERVE_ML_CACHE:-1}" == "1" && -d "${ML_CACHE_TMP:-}/localai/models" ]]; then
  cp -a "$ML_CACHE_TMP/localai/models/." "$ROOT_DIR/data/ai/localai/models/"
fi
if [[ "${PRESERVE_ML_CACHE:-1}" == "1" && -n "${ML_CACHE_TMP:-}" ]]; then
  rm -rf "$ML_CACHE_TMP"
fi

echo "Local app data, database data, and object storage have been reset."
if [[ "$PRESERVE_ML_CACHE" == "1" ]]; then
  echo "Preserved data/ai/models and data/ai/localai/models."
fi
