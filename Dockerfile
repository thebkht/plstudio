FROM node:24-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
# better-sqlite3 publishes prebuilt binaries for glibc but not musl, so on Alpine
# it compiles from source and needs a toolchain. Confined to this stage — the
# runtime only copies the finished node_modules.
RUN apk add --no-cache build-base python3
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile --config.onlyBuiltDependencies=better-sqlite3,esbuild,sharp,@esbuild-kit/core-utils,@esbuild-kit/esm-loader

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Collab is served same-origin at /collab, so there is no URL to bake in. Next
# inlines NEXT_PUBLIC_* at build time, so the one switch, `off`, belongs here.
ARG NEXT_PUBLIC_COLLAB
ENV NEXT_PUBLIC_COLLAB=$NEXT_PUBLIC_COLLAB

# Auth opens its SQLite file at module load, so the build would otherwise create
# an auth.db inside the image; point it at a throwaway path. The secret is a
# deliberate placeholder — the real one arrives at runtime via env_file, and
# would otherwise be baked into the image history.
ENV DATA_DIR=/tmp/build-data
ENV BETTER_AUTH_SECRET=build-time-placeholder
ENV BETTER_AUTH_URL=http://localhost:3000
ENV DATABASE_URL=file:/tmp/build-data/auth.db

# `next build --webpack`; see CLAUDE.md.
RUN pnpm build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY package.json ./
# `server.ts` runs from source through tsx — Next plus the Hocuspocus socket on
# one port — so it needs the modules the collab server imports, not just .next.
COPY server.ts tsconfig.json next.config.ts ./
COPY collab ./collab
COPY app ./app
# No `public/` in this repo; add a COPY for it if static assets are ever introduced.

# Needed by the `drizzle-kit push` in CMD below: the config reads ./db/paths.ts
# for the database location and ./db/schema.ts for the tables to create.
COPY db ./db
COPY drizzle.config.ts ./

# Everything durable — auth.db and the project JSON — lives here, so it must be a
# mounted volume in any real deployment. See docker-compose.yml.
ENV DATA_DIR=/data
RUN mkdir -p /data
VOLUME /data

ENV PORT=3000
EXPOSE 3000
# `getDb()` creates auth.db but never its tables, and DATA_DIR is a fresh volume
# on any new host — so without this a first deploy serves 500s on sign-up. `push`
# is idempotent and diffs against the live database, so it is a near no-op on
# every later start; `--force` skips the interactive prompt it would otherwise
# raise for destructive statements. `exec` keeps the server as PID 1, so SIGTERM
# reaches it and flushes pending collab stores before the container stops.
CMD ["sh", "-c", "node_modules/.bin/drizzle-kit push --force && exec node --import tsx server.ts"]
