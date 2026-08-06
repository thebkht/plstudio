# Oracle Schema Designer (PLStudio)

A modern, visual Oracle 12.2+ database schema designer and visual canvas built with Next.js, React, Tailwind CSS, TypeScript, and Hocuspocus (Yjs) for real-time collaboration.

![PLStudio Canvas](https://raw.githubusercontent.com/placeholder/hero.png)

## Features

- **Visual Canvas**: Draw tables, define columns, data types, primary keys, and foreign key relationships with an interactive drag-and-pan canvas.
- **Oracle Code Generation**:
  - DDL Export (`CREATE TABLE`, primary/foreign keys, `CHECK` constraints).
  - Sequence & Trigger generation or `GENERATED ALWAYS AS IDENTITY`.
  - Full PL/SQL CRUD package generation.
- **SQL Parser**: Import existing Oracle `CREATE TABLE` SQL statements back into visual canvas schemas.
- **Real-Time Collaboration**: Multi-user editing powered by Hocuspocus (Yjs over WebSockets) with presence cursors and shared state.
- **Organization & Workspaces**: Authentication and organization workspaces powered by Better Auth & SQLite.
- **Optimistic Concurrency & File Storage**: Durable, atomic JSON file store per project with revision conflict detection.

---

## Quick Start (Local Development)

### Prerequisites

- **Node.js**: v20+ (v22 recommended)
- **Package Manager**: `pnpm@11.0.9`

### Setup

Run the interactive setup script to check tools, install dependencies, generate `.env.local`, and push database schemas:

```bash
./setup.sh
```

Or non-interactively:

```bash
./setup.sh --yes
```

### Running Locally

Start the Next.js development server:

```bash
pnpm dev
```

In a second terminal, start the real-time collaboration server:

```bash
pnpm collab
```

Access the application at [http://localhost:3000](http://localhost:3000).

---

## Docker Compose Setup

Run both the web application and the collaboration server in containerized production mode using Docker Compose:

```bash
docker compose --env-file .env.local up --build -d
```

### Ports & Services

- **Web App**: [http://localhost:5555](http://localhost:5555) (mapped to container port `3000`)
- **Collab Server**: `ws://localhost:1234` / `http://localhost:1234`
- **Data Persistence**: the named volume `<project>_app-data` is mounted at `/data` in **both** services, holding `auth.db`, `projects/`, `yjs/` and `shares/`. It is a named volume rather than a bind mount into the checkout on purpose — see the comment at the top of `docker-compose.yml`. Move it between machines with `scripts/data-backup.sh` / `scripts/data-restore.sh` (below).
- **Schema**: the web container runs `drizzle-kit push` before `next start`, so a fresh volume gets its auth tables automatically and an older one is brought up to date. It is idempotent — an unchanged schema logs `No changes detected`.

To stop the containers:

```bash
docker compose down
```

### Windows

Docker is the whole toolchain here — Node, pnpm and the build all live inside the
image — so a Windows host needs **only Docker Desktop**. `setup.sh` is for the
local-development path (`pnpm dev`) and is neither needed nor runnable here.

```powershell
# 1. Install Docker Desktop (WSL2 backend) and clone the repo, then:
copy .env.example .env.local
#    Edit .env.local: BETTER_AUTH_SECRET, COLLAB_TOKEN_SECRET,
#    BETTER_AUTH_URL=http://localhost:5555, NEXT_PUBLIC_COLLAB_URL=ws://localhost:1234

# 2. Build and start — the auth tables are created on first boot
docker compose --env-file .env.local up --build -d

# 3. Bring data over from another machine (optional, see below)
#    .\scripts\data-restore.sh runs under Git Bash; the raw docker command is in
#    the "Moving the data between machines" section.

# 4. Start everything at logon
powershell -ExecutionPolicy Bypass -File scripts\install-boot.ps1
```

The app is then on <http://localhost:5555>. `-AtStartup` on the installer runs the
task before any user logs in, but Docker Desktop only starts at logon, so use it
only with a daemon that runs as a service.

### Running without Docker

Docker is a packaging choice, not a requirement — the app is a Next server plus a
`tsx` process, with SQLite and JSON files in a folder. Use this path when
virtualization is unavailable: on Windows, Docker can only run these Linux images
inside a WSL2 (or Hyper-V) VM, and enabling that needs admin rights and
VT-x/AMD-V turned on in firmware. Nothing here needs either.

```powershell
pnpm install
pnpm drizzle-kit push        # once — creates <DATA_DIR>/auth.db and its tables
pnpm build
powershell -ExecutionPolicy Bypass -File scripts\run-native.ps1        # start both
powershell -ExecutionPolicy Bypass -File scripts\run-native.ps1 -Stop  # stop both
powershell -ExecutionPolicy Bypass -File scripts\install-boot.ps1 -Native  # at logon
```

On macOS and Linux the same three steps apply, then run the two servers yourself:

```bash
pnpm start     # Next, on http://localhost:3000
pnpm collab    # Hocuspocus, in a second terminal
```

What differs from the Docker path:

- **Port 3000, not 5555.** `next start` serves 3000 directly with no port mapping,
  so `BETTER_AUTH_URL` must say `http://localhost:3000`.
- **`DATA_DIR` is a plain folder** (default `./data`) instead of a named volume, so
  the database and project JSON are browsable and `scripts/data-backup.sh` is not
  needed to look at them. Copy the folder to move an install.
- **`pnpm drizzle-kit push` is yours to run.** The container does it on every start;
  nothing does it for you here. Re-run it after a schema change.
- **Environment.** Next reads `.env.local` on its own, but `pnpm collab` reads
  `COLLAB_TOKEN_SECRET` straight from the environment — Docker supplies it through
  `env_file:`. `run-native.ps1` loads `.env.local` into both processes; if you start
  them by hand, export the variables first.
- **No admin needed anywhere.** `better-sqlite3` is pinned to `12.11.1`, the last
  release that publishes prebuilt binaries — `pnpm install` downloads a ready-made
  `win32-x64`/`win32-arm64`/`darwin-arm64` addon and compiles nothing, so Visual
  Studio Build Tools are not required. **Do not bump it to 13.x**: that release
  dropped `prebuild-install` and its prebuilt assets entirely, leaving only a
  `binding.gyp`, so package managers fall back to `node-gyp rebuild` and the
  install fails on any machine without an MSVC toolchain. (13.x is also outside
  `better-auth`'s declared `better-sqlite3: ^12.0.0` peer range.) If you ever do
  need to compile, add the "Desktop development with C++" workload through the
  Visual Studio Installer — that needs admin; the long-deprecated
  `npm i -g windows-build-tools` does not work on modern Node and should not be used.

Node 20+ (22 recommended) and pnpm are needed on the host for this path — and only
this one. Both can be installed without admin: extract the official Node zip into
your user folder, or use `fnm`, rather than the MSI.

### Moving the data between machines

Everything durable lives in the `app-data` volume, which is not browsable from the
host. These wrap the container-side `tar` for you:

```bash
./scripts/data-backup.sh                      # → ./drawsql-data-<timestamp>.tgz
./scripts/data-restore.sh drawsql-data-*.tgz  # → into this machine's volume
./scripts/data-restore.sh ./data              # or an old bind-mounted directory
```

Stop the stack before backing up if the app is in use (`docker compose stop`) —
SQLite can otherwise be caught mid-transaction. Restore refuses a non-empty volume
unless you pass `--force`, and stops the stack itself first. Both accept
`DRAWSQL_VOLUME=…` to target a different volume.

On Windows these run under Git Bash; without it, the same two steps are:

```powershell
docker run --rm -v drawsql_app-data:/data -v "${PWD}:/backup" alpine tar czf /backup/data.tgz -C /data .
docker run --rm -v drawsql_app-data:/data -v "${PWD}:/src" alpine tar xzf /src/data.tgz -C /data
```

A restored `auth.db` from an older build is migrated on the next start by the
`drizzle-kit push` in the container's command.

### Starting on boot

Both services are declared `restart: unless-stopped`, so the Docker daemon brings
them back on its own — but only for containers that already exist and were not
stopped by hand, and only once the daemon itself is running. The boot hook covers
the rest: it starts the engine, waits for it, then runs `compose up -d`.

```bash
./scripts/install-boot.sh                 # macOS + Linux
./scripts/install-boot.sh --uninstall

powershell -ExecutionPolicy Bypass -File scripts\install-boot.ps1   # Windows
powershell -ExecutionPolicy Bypass -File scripts\install-boot.ps1 -Uninstall
```

The installer picks the host's own init system and generates the unit from this
checkout's path, so it works from any clone:

| Host | Mechanism | Installed to |
| --- | --- | --- |
| macOS | launchd user agent (at login) | `~/Library/LaunchAgents/com.drawsql.boot.plist` |
| Linux, root | systemd system unit (at boot) | `/etc/systemd/system/drawsql.service` |
| Linux, user | systemd user unit + linger | `~/.config/systemd/user/drawsql.service` |
| Windows | Scheduled Task (at logon; `-AtStartup` for earlier) | Task `drawsql-boot` |
| No systemd | — | `@reboot /path/to/scripts/boot-drawsql.sh` in crontab |

`scripts/boot-drawsql.sh` (and `.ps1` on Windows) is the script all of these run,
and it is safe to run directly at any time. It detects `docker compose` vs
`docker-compose`, picks up `.env.local` or `.env`, and starts the engine the way
the host does — Docker Desktop, colima, or `systemctl start docker`. Logs go to
`~/Library/Logs/drawsql-boot.log`, `$XDG_STATE_HOME/drawsql-boot.log`, or
`%LOCALAPPDATA%\drawsql\boot.log`.

**macOS caveat:** launchd agents are refused access to `~/Documents`, `~/Desktop`
and `~/Downloads` by TCC, so a checkout in one of those is unreadable at login.
The installer handles it by placing a shim in `~/Library/Application Support/`
that falls back to starting the project's existing containers by their compose
label — no repo access needed. To get a full `compose up -d` (which is what picks
up compose-file edits, or recreates deleted containers), either move the checkout
outside those folders or grant `/bin/bash` Full Disk Access in System Settings →
Privacy & Security.

---

## Environment Variables

Ensure your `.env.local` contains the required configuration:

```ini
DATABASE_URL=...                                           # Optional external DB URL
BETTER_AUTH_SECRET=your-random-32-byte-secret               # Auth secret
BETTER_AUTH_URL=http://localhost:5555                      # Base URL of the app
NEXT_PUBLIC_COLLAB_URL=ws://localhost:1234                 # WebSocket URL for collab
COLLAB_PORT=1234                                           # Collab server port
COLLAB_TOKEN_SECRET=your-random-32-byte-collab-secret       # Token secret for collab rooms
DATA_DIR=./data                                            # Data storage path (default: ./data)
```

---

## CLI & Scripts Reference

| Command | Description |
| :--- | :--- |
| `pnpm dev` | Start Next.js development server |
| `pnpm collab` | Start Hocuspocus real-time collaboration server |
| `pnpm build` | Create optimized production build (`next build --webpack`) |
| `pnpm typecheck` | Run TypeScript type check (`tsc --noEmit`) |
| `pnpm test` | Run Vitest unit & integration test suite |
| `pnpm drizzle-kit push` | Push auth SQLite schema to `<DATA_DIR>/auth.db` |

---

## Project Structure

```
├── app/                  # Next.js App Router (pages, API routes, components)
│   ├── components/       # Designer canvas, table cards, relationship edges
│   ├── lib/              # Core domain: schema model, validation, SQL generator, parser
├── collab/               # Hocuspocus Yjs WebSocket collaboration server
├── db/                   # Storage layer (file-store for projects, SQLite for auth)
├── drizzle/              # Drizzle ORM migration files
├── docs/                 # Specifications & documentation
├── tests/                # Vitest test suite for generators, parser, motion, auth
├── docker-compose.yml    # Docker Compose multi-container setup
├── Dockerfile            # Web service container configuration
└── collab/Dockerfile     # Collaboration service container configuration
```
