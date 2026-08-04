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
- **Data Persistence**: Local directory `./data` is mounted to `/data` inside containers, persisting `auth.db` and project files.

To stop the containers:

```bash
docker compose down
```

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
