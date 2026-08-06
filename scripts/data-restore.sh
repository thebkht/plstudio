#!/usr/bin/env bash
# Load a backup — or a plain host directory such as an old bind-mounted ./data —
# into the DATA_DIR volume on this machine.
#
#   ./scripts/data-restore.sh drawsql-data-20260806-101500.tgz
#   ./scripts/data-restore.sh ./data            # pre-volume checkout layout
#   ./scripts/data-restore.sh backup.tgz --force   # overwrite a non-empty volume
#   DRAWSQL_VOLUME=other_app-data ./scripts/data-restore.sh backup.tgz
#
# Refuses a non-empty volume unless --force, because the merge would leave
# auth.db and the project files describing different worlds.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="${COMPOSE_PROJECT_NAME:-$(basename "$REPO" | tr '[:upper:]' '[:lower:]' | tr -cd '[:alnum:]_-')}"
VOLUME="${DRAWSQL_VOLUME:-${PROJECT}_app-data}"
IMAGE="${DRAWSQL_TAR_IMAGE:-alpine}"

SRC="${1:-}"; FORCE=false
[ "${2:-}" = "--force" ] && FORCE=true
[ -n "$SRC" ] || { echo "Usage: $0 <backup.tgz|directory> [--force]" >&2; exit 1; }
[ -e "$SRC" ] || { echo "No such file or directory: $SRC" >&2; exit 1; }

# A running web/collab container holds auth.db open; swapping the file underneath
# it corrupts the WAL. Stopping is cheap and the caller restarts when done.
if [ "$VOLUME" = "${PROJECT}_app-data" ] && [ -n "$(docker compose ps -q 2>/dev/null)" ]; then
  echo "Stopping the stack first..."; docker compose stop >/dev/null
  RESTART=true
fi

docker volume create "$VOLUME" >/dev/null
EXISTING="$(docker run --rm -v "$VOLUME:/data:ro" "$IMAGE" sh -c 'ls -A /data 2>/dev/null | head -1')"
if [ -n "$EXISTING" ] && ! $FORCE; then
  echo "Volume $VOLUME is not empty. Back it up and re-run with --force:" >&2
  echo "  ./scripts/data-backup.sh && $0 $SRC --force" >&2
  exit 1
fi

if [ -d "$SRC" ]; then
  SRC_DIR="$(cd "$SRC" && pwd)"
  docker run --rm -v "$VOLUME:/data" -v "$SRC_DIR:/src:ro" "$IMAGE" \
    sh -c 'rm -rf /data/* /data/.[!.]* 2>/dev/null; cp -a /src/. /data/'
else
  SRC_DIR="$(cd "$(dirname "$SRC")" && pwd)"
  docker run --rm -v "$VOLUME:/data" -v "$SRC_DIR:/src:ro" "$IMAGE" \
    sh -c "rm -rf /data/* /data/.[!.]* 2>/dev/null; tar xzf '/src/$(basename "$SRC")' -C /data"
fi

echo "Restored $SRC into volume $VOLUME:"
docker run --rm -v "$VOLUME:/data:ro" "$IMAGE" sh -c 'ls -la /data'
[ "${RESTART:-false}" = true ] && { echo "Starting the stack again..."; docker compose start; }
echo "Done. The container runs 'drizzle-kit push' on start, so an older auth.db is brought up to date automatically."
