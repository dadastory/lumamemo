#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/../../../.." && pwd)
REGION="${NOMINATIM_REGION:-${1:-china}}"

case "$REGION" in
  china)
    DEFAULT_PBF_URL="https://download.geofabrik.de/asia/china-latest.osm.pbf"
    ;;
  monaco)
    DEFAULT_PBF_URL="https://download.geofabrik.de/europe/monaco-latest.osm.pbf"
    ;;
  http://*|https://*)
    DEFAULT_PBF_URL="$REGION"
    ;;
  *)
    echo "Unknown Nominatim region: $REGION" >&2
    echo "Use 'china', 'monaco', or pass a full .osm.pbf URL." >&2
    exit 1
    ;;
esac

export NOMINATIM_PBF_URL="${NOMINATIM_PBF_URL:-$DEFAULT_PBF_URL}"
export HTTP_PROXY=
export HTTPS_PROXY=
export ALL_PROXY=
export http_proxy=
export https_proxy=
export all_proxy=
export NO_PROXY='*'
export no_proxy='*'

if [ "${NOMINATIM_RESET_DATA:-0}" = "1" ]; then
  rm -rf "$ROOT_DIR/data/middleware/nominatim"
fi

docker compose \
  -f "$ROOT_DIR/docker-compose.yml" \
  -f "$ROOT_DIR/docker-compose.local-build.yml" \
  -f "$ROOT_DIR/third-party/middleware/docker-compose.yml" \
  up -d nominatim

echo "Nominatim import started with PBF_URL=$NOMINATIM_PBF_URL"
