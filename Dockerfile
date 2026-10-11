# Local, synthetic-data demo. Hosted PostgreSQL deployment is a separate profile.
FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY client/package.json client/package-lock.json ./client/
RUN npm --prefix client ci
COPY . .
RUN npm run check:version
RUN npm run build:client
RUN MODE_EXPO_WEB=1 npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    MODE_EXPO_WEB=1 \
    SQLITE_PATH=/data/mode.sqlite
# Use the documented next start mode, preserving the existing routing config.
# The full root dependency tree also supports loading next.config.ts at runtime.
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/VERSION ./VERSION
COPY --from=build --chown=node:node /app/next.config.ts ./next.config.ts
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health/ready',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
