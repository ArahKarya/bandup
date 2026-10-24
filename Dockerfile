# syntax=docker/dockerfile:1

# --- deps + build ---------------------------------------------------------
FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN pnpm install --frozen-lockfile
COPY . .
# The client is constructed at import time; no connection is made during the build.
RUN pnpm exec prisma generate && BUILD_STANDALONE=1 DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm build

# --- setup: migrations + content sync (run once per deploy) ---------------
FROM builder AS setup
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && pnpm content:sync"]

# --- runtime --------------------------------------------------------------
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 STORAGE_DIR=/data
RUN useradd --system --uid 1001 bandup && mkdir -p /data && chown bandup /data
COPY --from=builder --chown=bandup /app/.next/standalone ./
COPY --from=builder --chown=bandup /app/.next/static ./.next/static
COPY --from=builder --chown=bandup /app/public ./public
COPY --from=builder --chown=bandup /app/content/assets ./content/assets
USER bandup
EXPOSE 3000
VOLUME ["/data"]
CMD ["node", "server.js"]
