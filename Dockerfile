# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ── dependências (inclui dev para o build) ──
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ── build ──
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── dependências de produção ──
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# ── imagem final ──
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    TZ=America/Sao_Paulo
RUN apk add --no-cache tzdata \
 && addgroup -S app && adduser -S app -G app

COPY --from=prod-deps --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/.next ./.next
COPY --from=build --chown=app:app /app/public ./public
COPY --chown=app:app package.json next.config.mjs prisma.config.mjs ./
COPY --chown=app:app prisma ./prisma
COPY --chown=app:app docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["./docker-entrypoint.sh"]
