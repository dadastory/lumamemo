#!/usr/bin/env sh
set -eu

if [ -z "${PMTILES_URL:-}" ]; then
  echo "PMTILES_URL is required." >&2
  echo "Example: PMTILES_URL=https://example.com/global.pmtiles PMTILES_FILENAME=global.pmtiles $0" >&2
  exit 1
fi

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/../../../.." && pwd)
TARGET_DIR="${PMTILES_TARGET_DIR:-$ROOT_DIR/data/middleware/pmtiles}"
TARGET_FILE="${PMTILES_FILENAME:-global.pmtiles}"
TARGET_PATH="$TARGET_DIR/$TARGET_FILE"
TMP_PATH="$TARGET_PATH.tmp"

mkdir -p "$TARGET_DIR"

HTTP_PROXY= HTTPS_PROXY= ALL_PROXY= \
http_proxy= https_proxy= all_proxy= \
NO_PROXY='*' no_proxy='*' \
curl --fail --location --show-error --progress-bar --noproxy '*' \
  "$PMTILES_URL" \
  --output "$TMP_PATH"

mv "$TMP_PATH" "$TARGET_PATH"
echo "Downloaded $TARGET_PATH"
