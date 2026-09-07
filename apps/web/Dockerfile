# Built with the monorepo root as context (e.g. `docker build -f apps/web/Dockerfile .`
# from the repo root), since apps/web depends on the sibling workspace
# packages @anchor/shared and @anchor/ui.

# Build stage
FROM node:18-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/

RUN npm ci

COPY packages/shared ./packages/shared
COPY packages/ui ./packages/ui
COPY apps/web ./apps/web

RUN npm run build --workspace=@anchor/shared
RUN npm run build --workspace=@anchor/ui
RUN npm run build --workspace=@anchor/web

# Production stage
FROM node:18-alpine AS production
WORKDIR /app

RUN addgroup -g 1001 -S anchor && adduser -S anchor -u 1001

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/next.config.js ./apps/web/next.config.js
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json

RUN chown -R anchor:anchor /app
USER anchor

ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

WORKDIR /app/apps/web
CMD ["npm", "start"]
