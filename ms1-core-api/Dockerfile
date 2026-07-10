# ── Build stage ────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# ── Runtime stage ─────────────────────────────────────────────
FROM node:20-alpine AS runtime
RUN addgroup -g 1001 -S medguard && adduser -S medguard -u 1001 -G medguard
WORKDIR /app

COPY --from=build --chown=medguard:medguard /app/node_modules ./node_modules
COPY --chown=medguard:medguard . .

USER medguard
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/health || exit 1

CMD ["node", "src/index.js"]
