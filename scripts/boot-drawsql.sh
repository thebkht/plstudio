#!/usr/bin/env bash
# Start the container engine if it is not already up, then bring the drawsql
# stack up. Installed to run at boot/login by scripts/install-boot.sh, but it is
# safe to run by hand at any time — every step is a no-op when things are up.
#
# Portable on purpose: the repo path is derived from this file, the compose
# command and env file are detected, and the engine is started the way the host
# actually starts it (Docker Desktop on macOS, systemd or an already-running
# daemon on Linux, nothing to do in CI where Docker is a service).
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Boot contexts (launchd, systemd, cron) hand over a bare PATH, so the usual
# install locations for the Docker CLI have to be spelled out.
export PATH="$PATH:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/snap/bin:/Applications/Docker.app/Contents/Resources/bin"

default_log() {
  case "$(uname -s)" in
    Darwin) echo "$HOME/Library/Logs/drawsql-boot.log" ;;
    *) echo "${XDG_STATE_HOME:-$HOME/.local/state}/drawsql-boot.log" ;;
  esac
}
LOG="${DRAWSQL_BOOT_LOG:-$(default_log)}"
mkdir -p "$(dirname "$LOG")" 2>/dev/null
log() { echo "$(date '+%Y-%m-%d %H:%M:%S') drawsql-boot: $*" >> "$LOG"; }

# Compose v2 is a docker subcommand; older hosts still only have the v1 binary.
if docker compose version >/dev/null 2>&1; then compose() { docker compose "$@"; }
elif command -v docker-compose >/dev/null 2>&1; then compose() { docker-compose "$@"; }
elif command -v docker >/dev/null 2>&1; then log "docker present but no compose plugin"; exit 1
else log "docker is not installed or not on PATH"; exit 1
fi

start_engine() {
  docker info >/dev/null 2>&1 && return 0
  case "$(uname -s)" in
    Darwin)
      if [ -d /Applications/Docker.app ]; then open -ga Docker
      elif command -v colima >/dev/null 2>&1; then colima start
      else log "no Docker Desktop or colima found"; return 1; fi ;;
    Linux)
      # Rootless Docker runs as a user unit; the packaged daemon is a system one
      # and needs privileges we may not have non-interactively.
      systemctl --user start docker 2>/dev/null && return 0
      if [ "$(id -u)" = 0 ]; then systemctl start docker 2>/dev/null || service docker start 2>/dev/null
      else sudo -n systemctl start docker 2>/dev/null || log "cannot start the daemon unprivileged; waiting for it"; fi ;;
    *) log "unknown platform $(uname -s); waiting for an existing daemon" ;;
  esac
  return 0
}

log "starting"
start_engine

# The daemon accepts connections well after its process exists, so poll instead
# of sleeping a fixed amount. ~3 minutes covers a cold VM on a slow disk.
for _ in $(seq 1 "${DRAWSQL_BOOT_WAIT:-90}"); do
  docker info >/dev/null 2>&1 && break
  sleep 2
done
docker info >/dev/null 2>&1 || { log "the docker daemon never came up"; exit 1; }

cd "$REPO" || exit 1
# `--env-file` only feeds ${...} interpolation in the compose file; compose reads
# `.env` on its own, and the services carry their own `env_file:`.
ENV_ARGS=()
for candidate in "${DRAWSQL_ENV_FILE:-}" .env.local .env; do
  [ -n "$candidate" ] && [ -f "$candidate" ] && { ENV_ARGS=(--env-file "$candidate"); break; }
done

if compose "${ENV_ARGS[@]}" up -d >> "$LOG" 2>&1; then log "stack up"; else log "compose up failed"; exit 1; fi
