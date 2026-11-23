# Hafize Node backend for Cloud Run. No Google/NVIDIA/GitHub credentials
# are copied into the image: secrets are injected only at deployment time.
FROM node:24.21.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev --no-audit --no-fund

FROM node:24.21.0-bookworm-slim
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    HAFIZE_AUTH_REQUIRED=true \
    HAFIZE_COOKIE_SECURE=true \
    HAFIZE_DATA_DIR=/tmp/hafize-data \
    HAFIZE_WORKSPACE_DIR=/tmp/hafize-workspace
WORKDIR /app
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 8080
CMD ["node", "--import", "./lib/production-guard.ts", "server.ts"]
