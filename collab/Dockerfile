# The collab server shares the repo's source and lockfile: `schemaFromYDoc` must
# be the exact same projection the browser uses, so it is imported, never copied.
FROM node:24-alpine

WORKDIR /app
RUN corepack enable

# better-sqlite3 has no musl prebuild and compiles from source. The collab server
# never opens the auth database, but it shares the repo's lockfile, so the
# toolchain has to be here for the install to succeed.
RUN apk add --no-cache build-base python3
# pnpm-workspace.yaml carries `allowBuilds`, which pnpm 11 requires to run
# esbuild's install script — tsx cannot run without it.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY app ./app
COPY db ./db
COPY collab ./collab

# Must be the same volume the web service mounts: this process mirrors each
# document back into the project's JSON file.
ENV DATA_DIR=/data
RUN mkdir -p /data
VOLUME /data

EXPOSE 1234
CMD ["pnpm", "collab"]
