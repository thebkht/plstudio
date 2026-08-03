#!/usr/bin/env bash
#
# Interactive first-run setup: toolchain, dependencies, .env.local, schema push.
#
#   ./setup.sh              # interactive
#   ./setup.sh --yes        # non-interactive; keeps existing .env.local values,
#                           # generates missing secrets, skips anything that
#                           # needs an answer
#
set -euo pipefail

cd "$(dirname "$0")"

NODE_MIN_MAJOR=20
NODE_INSTALL_VERSION=22
ENV_FILE=".env.local"
DATA_DIR_DEFAULT="./data"
ASSUME_YES=false
[[ "${1:-}" == "--yes" || "${1:-}" == "-y" ]] && ASSUME_YES=true

if [[ -t 1 ]]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; BLUE=$'\033[34m'; RESET=$'\033[0m'
else
  BOLD=""; DIM=""; RED=""; GREEN=""; YELLOW=""; BLUE=""; RESET=""
fi

step()  { printf '\n%s==>%s %s%s%s\n' "$BLUE" "$RESET" "$BOLD" "$1" "$RESET"; }
info()  { printf '    %s\n' "$1"; }
ok()    { printf '    %s✓%s %s\n' "$GREEN" "$RESET" "$1"; }
warn()  { printf '    %s!%s %s\n' "$YELLOW" "$RESET" "$1"; }
die()   { printf '\n%serror:%s %s\n' "$RED" "$RESET" "$1" >&2; exit 1; }

# Prompts read from the terminal directly so the script still works when piped.
ask() { # ask <prompt> <default>
  local answer
  if $ASSUME_YES || [[ ! -e /dev/tty ]]; then printf '%s' "$2"; return 0; fi
  read -r -p "    $1" answer </dev/tty || answer=""   # no controlling tty: take the default
  printf '%s' "${answer:-$2}"
  return 0
}

confirm() { # confirm <prompt> <default y|n>
  local answer
  answer=$(ask "$1 " "$2")
  [[ "${answer:0:1}" =~ ^[Yy]$ ]]
}

random_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 32 | tr -d '\n'
  else
    node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
  fi
}

# ---------------------------------------------------------------- node --------
step "Checking Node.js"

node_major() { node -v 2>/dev/null | sed 's/^v\([0-9]*\).*/\1/'; }

load_nvm() {
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  # shellcheck disable=SC1091
  [[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh" && return 0
  [[ -s "/opt/homebrew/opt/nvm/nvm.sh" ]] && . "/opt/homebrew/opt/nvm/nvm.sh" && return 0
  return 1
}

install_node() {
  if load_nvm; then
    info "Installing Node $NODE_INSTALL_VERSION via nvm…"
    nvm install "$NODE_INSTALL_VERSION" >/dev/null
    nvm use "$NODE_INSTALL_VERSION" >/dev/null
    return 0
  fi
  if [[ "$(uname -s)" == "Darwin" ]] && command -v brew >/dev/null 2>&1; then
    info "Installing Node $NODE_INSTALL_VERSION via Homebrew…"
    brew install "node@$NODE_INSTALL_VERSION"
    brew link --overwrite --force "node@$NODE_INSTALL_VERSION"
    return 0
  fi
  if confirm "Install nvm (downloads from github.com) and Node $NODE_INSTALL_VERSION? [y/N]" "n"; then
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    load_nvm || die "nvm installed but could not be loaded; open a new shell and re-run ./setup.sh"
    nvm install "$NODE_INSTALL_VERSION" >/dev/null
    nvm use "$NODE_INSTALL_VERSION" >/dev/null
    return 0
  fi
  die "Node $NODE_MIN_MAJOR+ is required. See https://nodejs.org/en/download"
}

if ! command -v node >/dev/null 2>&1; then
  warn "Node.js not found."
  install_node
elif (( $(node_major) < NODE_MIN_MAJOR )); then
  warn "Node $(node -v) is older than the required v$NODE_MIN_MAJOR (Next 16)."
  install_node
fi
ok "Node $(node -v)"

# ---------------------------------------------------------------- pnpm --------
step "Checking pnpm"
# The repo pins pnpm via package.json#packageManager, so corepack is the path
# that gets the exact version rather than whatever is globally installed.
if command -v corepack >/dev/null 2>&1; then
  corepack enable >/dev/null 2>&1 || warn "corepack enable failed (no write access?); falling back to the pnpm on PATH"
  corepack prepare --activate >/dev/null 2>&1 || true
fi
command -v pnpm >/dev/null 2>&1 || npm install -g pnpm
ok "pnpm $(pnpm --version)"

# ----------------------------------------------------------------- env --------
step "Configuring $ENV_FILE"

# Parallel indexed arrays rather than an associative one: macOS still ships
# bash 3.2, which has no `declare -A`.
ENV_KEYS=()
ENV_VALS=()

# These lookups must return 0 even on a miss: a nonzero status would propagate
# out of `i=$(env_index …)` and trip `set -e`.
env_index() { # echoes the index of <key>, or nothing
  local i
  (( ${#ENV_KEYS[@]} )) || return 0
  for i in "${!ENV_KEYS[@]}"; do
    [[ "${ENV_KEYS[$i]}" == "$1" ]] && { printf '%s' "$i"; return 0; }
  done
  return 0
}

set_env() { # set_env <key> <value>
  local i; i=$(env_index "$1")
  if [[ -n "$i" ]]; then ENV_VALS[$i]="$2"; else ENV_KEYS+=("$1"); ENV_VALS+=("$2"); fi
}

get_env() { # get_env <key>
  local i; i=$(env_index "$1")
  [[ -n "$i" ]] && printf '%s' "${ENV_VALS[$i]}"
  return 0
}

if [[ -f "$ENV_FILE" ]]; then
  # Read existing values so a re-run tops up what's missing instead of clobbering.
  while IFS= read -r line; do
    [[ "$line" =~ ^[[:space:]]*# || "$line" != *=* ]] && continue
    key="${line%%=*}"; value="${line#*=}"
    key="$(printf '%s' "$key" | tr -d '[:space:]')"
    [[ -n "$key" ]] && set_env "$key" "$value"
  done < "$ENV_FILE"
  ok "Found $ENV_FILE with ${#ENV_KEYS[@]} variables — keeping existing values, filling in the gaps."
fi

# -- data directory -----------------------------------------------------------
# There is no database server: auth lives in <DATA_DIR>/auth.db and each project
# is a JSON file beside it. Only record DATA_DIR when it differs from the default,
# so the common case stays out of .env.local.
data_dir="$(get_env DATA_DIR)"
[[ -n "$data_dir" ]] || data_dir="$DATA_DIR_DEFAULT"
mkdir -p "$data_dir"
ok "Data directory ready at $data_dir."

# -- auth ---------------------------------------------------------------------
[[ -n "$(get_env BETTER_AUTH_SECRET)" ]] || { set_env BETTER_AUTH_SECRET "$(random_secret)"; ok "Generated BETTER_AUTH_SECRET."; }
[[ -n "$(get_env BETTER_AUTH_URL)" ]]    || set_env BETTER_AUTH_URL "http://localhost:3000"

# -- collaboration ------------------------------------------------------------
# Unset NEXT_PUBLIC_COLLAB_URL is a supported mode: the designer degrades to
# single-player editing on the debounced PUT, so only opt in when asked.
if [[ -n "$(get_env NEXT_PUBLIC_COLLAB_URL)" ]]; then
  ok "Realtime collaboration already configured."
  [[ -n "$(get_env COLLAB_TOKEN_SECRET)" ]] || { set_env COLLAB_TOKEN_SECRET "$(random_secret)"; ok "Generated COLLAB_TOKEN_SECRET."; }
  [[ -n "$(get_env COLLAB_PORT)" ]] || set_env COLLAB_PORT "1234"
elif confirm "Enable realtime collaboration (Hocuspocus on :1234)? [Y/n]" "y"; then
  set_env NEXT_PUBLIC_COLLAB_URL "ws://localhost:1234"
  set_env COLLAB_PORT "1234"
  [[ -n "$(get_env COLLAB_TOKEN_SECRET)" ]] || set_env COLLAB_TOKEN_SECRET "$(random_secret)"
  ok "Collaboration enabled — run it with \`pnpm collab\` alongside \`pnpm dev\`."
else
  info "Skipping collaboration; the designer falls back to single-player editing."
fi

# -- write --------------------------------------------------------------------
if [[ -f "$ENV_FILE" ]]; then
  cp "$ENV_FILE" "$ENV_FILE.bak"
  info "Backed up the previous file to $ENV_FILE.bak"
fi
{
  printf '# Generated by ./setup.sh on %s\n' "$(date '+%Y-%m-%d %H:%M')"
  for i in "${!ENV_KEYS[@]}"; do printf '%s=%s\n' "${ENV_KEYS[$i]}" "${ENV_VALS[$i]}"; done
} > "$ENV_FILE"
ok "Wrote $ENV_FILE (git-ignored)."

# --------------------------------------------------------- dependencies -------
step "Installing dependencies"
pnpm install
ok "Dependencies installed."

# ----------------------------------------------------------------- auth -------
step "Auth schema"
if confirm "Create the auth tables now (drizzle-kit push)? [Y/n]" "y"; then
  if DATA_DIR="$data_dir" pnpm drizzle-kit push; then
    ok "Auth tables created in $data_dir/auth.db."
  else
    warn "drizzle-kit push failed — run \`pnpm drizzle-kit push\` once the problem is fixed."
  fi
else
  info "Skipped. Run \`pnpm drizzle-kit push\` before starting the app."
fi

# ---------------------------------------------------------------- done --------
printf '\n%s🎉 Setup complete.%s\n\n' "$GREEN" "$RESET"
printf '  %spnpm dev%s      start the Next dev server on http://localhost:3000\n' "$BOLD" "$RESET"
if [[ -n "$(get_env NEXT_PUBLIC_COLLAB_URL)" ]]; then
  printf '  %spnpm collab%s   start the Hocuspocus collaboration server (separate terminal)\n' "$BOLD" "$RESET"
fi
printf '  %spnpm test%s     run the domain-layer test suite\n' "$BOLD" "$RESET"
printf '\n  %sAll data lives in %s — back that up, and mount it as a volume in Docker.%s\n' "$DIM" "$data_dir" "$RESET"
printf '\n'
