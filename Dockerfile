FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev
FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates libglib2.0-0 libgomp1 && rm -rf /var/lib/apt/lists/*
COPY requirements-video.txt /tmp/requirements-video.txt
RUN python3 -m venv /opt/video && /opt/video/bin/pip install --no-cache-dir -r /tmp/requirements-video.txt
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4310 DEMO_MODE=false VIDEO_PYTHON=/opt/video/bin/python
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/backend ./backend
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/requirements-video.txt ./requirements-video.txt
COPY --from=build --chown=node:node /app/licenses ./licenses
COPY --from=build --chown=node:node /app/THIRD_PARTY_NOTICES.md ./THIRD_PARTY_NOTICES.md
USER node
EXPOSE 4310
CMD ["node","backend/server.mjs"]
