#!/usr/bin/env bash
# Copy everything durable — auth.db, projects/, yjs/, shares/ — out of the
# DATA_DIR volume into a portable tarball.
#
#   ./scripts/data-backup.sh                    # ./drawsql-data-YYYYMMDD-HHMMSS.tgz
#   ./scripts/data-backup.sh /path/to/out.tgz
#   DRAWSQL_VOLUME=other_app-data ./scripts/data-backup.sh
#
# The volume is not browsable from the host (see docker-compose.yml), so the copy
# runs inside a throwaway container that has it mounted. Reading a live SQLite
# file can catch it mid-transaction; stop the stack first if the app is in use:
#   docker compose stop && ./scripts/data-backup.sh && docker compose start
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="${COMPOSE_PROJECT_NAME:-$(basename "$REPO" | tr '[:upper:]' '[:lower:]' | tr -cd '[:alnum:]_-')}"
VOLUME="${DRAWSQL_VOLUME:-${PROJECT}_app-data}"
IMAGE="${DRAWSQL_TAR_IMAGE:-alpine}"

docker volume inspect "$VOLUME" >/dev/null 2>&1 || { echo "No such volume: $VOLUME (set DRAWSQL_VOLUME)" >&2; exit 1; }

OUT="${1:-$REPO/drawsql-data-$(date '+%Y%m%d-%H%M%S').tgz}"
mkdir -p "$(dirname "$OUT")"
OUT_DIR="$(cd "$(dirname "$OUT")" && pwd)"
OUT_NAME="$(basename "$OUT")"

docker run --rm -v "$VOLUME:/data:ro" -v "$OUT_DIR:/backup" "$IMAGE" \
  tar czf "/backup/$OUT_NAME" -C /data .

echo "Wrote $OUT_DIR/$OUT_NAME ($(du -h "$OUT_DIR/$OUT_NAME" | cut -f1)) from volume $VOLUME"
echo "Restore it elsewhere with:  ./scripts/data-restore.sh $OUT_NAME"
