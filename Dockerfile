FROM node:24-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
# better-sqlite3 publishes prebuilt binaries for glibc but not musl, so on Alpine
# it compiles from source and needs a toolchain. Confined to this stage — the
# runtime only copies the finished node_modules.
RUN apk add --no-cache build-base python3
# pnpm-workspace.yaml carries `allowBuilds`; without it pnpm 11 refuses to run
# better-sqlite3's, esbuild's and sharp's install scripts and fails the install outright.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next inlines NEXT_PUBLIC_* into the client bundle at build time, so the real
# collab URL must be present here — a runtime env var would never reach the browser.
ARG NEXT_PUBLIC_COLLAB_URL
ENV NEXT_PUBLIC_COLLAB_URL=$NEXT_PUBLIC_COLLAB_URL

# Auth opens its SQLite file at module load, so the build would otherwise create
# an auth.db inside the image; point it at a throwaway path. The secret is a
# deliberate placeholder — the real one arrives at runtime via env_file, and
# would otherwise be baked into the image history.
ENV DATA_DIR=/tmp/build-data
ENV BETTER_AUTH_SECRET=build-time-placeholder
ENV BETTER_AUTH_URL=http://localhost:3000

# `next build --webpack`; see CLAUDE.md.
RUN pnpm build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY package.json ./
# No `public/` in this repo; add a COPY for it if static assets are ever introduced.

# Everything durable — auth.db and the project JSON — lives here, so it must be a
# mounted volume in any real deployment. See docker-compose.yml.
ENV DATA_DIR=/data
RUN mkdir -p /data
VOLUME /data

EXPOSE 3000
CMD ["pnpm", "next", "start"]
