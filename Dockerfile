FROM node:24-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
# pnpm-workspace.yaml carries `allowBuilds`; without it pnpm 11 refuses to run
# esbuild's and sharp's install scripts and fails the install outright.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next inlines NEXT_PUBLIC_* into the client bundle at build time, so the real
# collab URL must be present here — a runtime env var would never reach the browser.
ARG NEXT_PUBLIC_COLLAB_URL
ENV NEXT_PUBLIC_COLLAB_URL=$NEXT_PUBLIC_COLLAB_URL

# Auth builds its database client at module load, so the build needs these to be
# parseable — not reachable. Deliberately placeholders: real secrets arrive at
# runtime via env_file, and would otherwise be baked into the image history.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
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
EXPOSE 3000
CMD ["pnpm", "next", "start"]
