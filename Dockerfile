# syntax=docker/dockerfile:1.7
#
# Two images from one build:
#   server  API, worker and database migrations (same code, different command)
#   web     Caddy with the web app and admin panel built in; it serves them over HTTPS
#           and passes /api to the API.
# Build: docker build --target server -t vakilmitra-server .   (and --target web)

ARG NODE_IMAGE=node:22-bookworm-slim
# Same major version as the database in deploy/compose.yml.
ARG PG_IMAGE=postgres:16-bookworm

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /app

# ---------- build everything ----------
FROM base AS build
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile
# Browser settings are fixed at build time. Leave the DSN empty to build without error reporting.
ARG VITE_SENTRY_DSN=""
ARG VITE_SENTRY_ENVIRONMENT="production"
ARG APP_VERSION="dev"
# The site's address (https://…), for the search-engine tags and sitemap on the public pages.
ARG SITE_URL=""
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN VITE_SENTRY_ENVIRONMENT=$VITE_SENTRY_ENVIRONMENT VITE_APP_VERSION=$APP_VERSION SITE_URL=$SITE_URL
RUN pnpm turbo run build
# Keep only what the API and worker need at run time.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    rm -rf node_modules apps/*/node_modules packages/*/node_modules \
 && pnpm install --frozen-lockfile --prod --filter "@vakilmitra/api..." --filter "@vakilmitra/worker..."

# ---------- server: API, worker, migrations ----------
# Built on the official Postgres 16 image for its pg_dump and pg_restore (nightly backups), which
# then always match the database server's version; Node is copied in from the Node image.
FROM ${PG_IMAGE} AS server
COPY --from=base /usr/local/bin/node /usr/local/bin/node
RUN useradd --create-home --uid 1000 --shell /usr/sbin/nologin app \
 && mkdir -p /data/blobs && chown app:app /data/blobs
# /data/blobs: client files when STORAGE_DRIVER=fs (a new volume takes this owner).
ENV NODE_ENV=production PG_BIN_DIR=/usr/lib/postgresql/16/bin
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/apps/worker ./apps/worker
ARG APP_VERSION="dev"
ENV APP_VERSION=$APP_VERSION
USER app
WORKDIR /app/apps/api
EXPOSE 4000
ENTRYPOINT []
CMD ["node", "--import", "./dist/instrument.js", "dist/index.js"]

# ---------- web: static sites behind Caddy ----------
FROM caddy:2 AS web
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv/web
COPY --from=build /app/apps/admin/dist /srv/admin
