# syntax=docker/dockerfile:1

# This image targets the Node 22 runtime declared in package.json. It builds a
# Next.js standalone server, so the final image does not carry development
# dependencies or the source tree.
FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app
RUN corepack enable

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma needs a syntactically valid URL while generating its client. The real
# DATABASE_URL is supplied only when the container runs.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/contractorcopilot?schema=public"
ENV DIRECT_URL="postgresql://build:build@localhost:5432/contractorcopilot?schema=public"
ENV DOCKER_BUILD=true
RUN pnpm db:generate
RUN pnpm build

FROM node:22-bookworm-slim AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

WORKDIR /app

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
