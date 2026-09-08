# This Dockerfile must be built with the monorepo root as the build context
# (e.g. `docker build -f apps/api/Dockerfile .` from the repo root), because
# apps/api depends on the sibling workspace package @anchor/database - Docker
# can't COPY files from outside the build context, so a context scoped to
# apps/api/ alone cannot work here.

# Build stage
FROM node:18-alpine AS builder
WORKDIR /app

# Prisma's engine binaries need OpenSSL present both to generate the correct
# linux-musl-openssl-3.0.x engine here (see schema.prisma binaryTargets) and,
# in the production stage below, to actually load it at runtime.
RUN apk add --no-cache openssl

# Copy workspace manifests first for better layer caching
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/
COPY packages/database/prisma ./packages/database/prisma

RUN npm ci

# Copy source and build
COPY packages/database ./packages/database
COPY apps/api ./apps/api

RUN npm run build --workspace=@anchor/api

# Production stage
FROM node:18-alpine AS production
WORKDIR /app

RUN apk add --no-cache openssl

RUN addgroup -g 1001 -S anchor && adduser -S anchor -u 1001

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/packages ./packages

RUN chown -R anchor:anchor /app
USER anchor

ENV NODE_ENV=production
EXPOSE 3000

# Health check (matches the global 'api' prefix set in main.ts)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "apps/api/dist/main.js"]
