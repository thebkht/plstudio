# The collab server shares the repo's source and lockfile: `schemaFromYDoc` must
# be the exact same projection the browser uses, so it is imported, never copied.
FROM node:22-alpine

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY app ./app
COPY db ./db
COPY collab ./collab

EXPOSE 1234
CMD ["pnpm", "collab"]
