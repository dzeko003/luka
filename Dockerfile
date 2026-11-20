# syntax=docker/dockerfile:1.10
# Image de Luka (Next.js en serveur autonome) + image de migration de la base.
#   docker build --target runner   -t luka-web .
#   docker build --target migrator -t luka-migrate .
FROM node:24-alpine AS deps
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts

FROM deps AS build
COPY . .
# Clé publique du captcha : inscrite dans le code du navigateur, donc fixée au build
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY=""
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY
# Signalement des erreurs du navigateur (Sentry) et version en ligne : fixés au build, vides en local
ARG NEXT_PUBLIC_SENTRY_DSN=""
ARG NEXT_PUBLIC_LUKA_VERSION=""
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN NEXT_PUBLIC_LUKA_VERSION=$NEXT_PUBLIC_LUKA_VERSION
# Le build ne se connecte pas à la base, mais le module l'exige
RUN DATABASE_URL=postgres://build:build@localhost:5432/build npm run build

FROM node:24-alpine AS migrator
WORKDIR /app
COPY package.json ./
# Seulement les deux paquets utiles, aux versions du projet (image légère)
RUN --mount=type=cache,target=/root/.npm \
    orm=$(node -p "require('./package.json').dependencies['drizzle-orm']") \
    && pg=$(node -p "require('./package.json').dependencies.postgres") \
    && rm package.json \
    && npm install --no-save --ignore-scripts --no-package-lock "drizzle-orm@$orm" "postgres@$pg"
COPY drizzle ./drizzle
COPY scripts/migrate.mjs ./scripts/
USER node
CMD ["node", "scripts/migrate.mjs"]

FROM node:24-alpine AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=6 CMD wget -q -O /dev/null http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
