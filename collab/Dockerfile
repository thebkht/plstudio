# The collab server shares the repo's source and lockfile: `schemaFromYDoc` must
# be the exact same projection the browser uses, so it is imported, never copied.
FROM node:24-alpine

WORKDIR /app
RUN corepack enable

# pnpm-workspace.yaml carries `allowBuilds`, which pnpm 11 requires to run
# esbuild's install script — tsx cannot run without it.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY app ./app
COPY db ./db
COPY collab ./collab

EXPOSE 1234
CMD ["pnpm", "collab"]
