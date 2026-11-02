# Multi-stage Dockerfile for Thai AI Study backend
FROM oven/bun:1.4.4-slim AS deps
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.4.4-slim AS runtime
WORKDIR /app

# Install poppler-utils for PDF OCR rendering and CA certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Verify Thai Intl.Segmenter works in runtime
RUN bun -e "console.log([...new Intl.Segmenter('th', {granularity:'word'}).segment('สวัสดีครับนักเรียน')].length)"

# Create storage directory and assign permissions
RUN mkdir -p /data/storage /data/db && chown -R bun:bun /data/storage /data/db

COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock tsconfig.json drizzle.config.ts ./
COPY drizzle ./drizzle
COPY scripts ./scripts
COPY src ./src

ENV NODE_ENV=production
ENV PORT=3000
ENV STORAGE_DIR=/data/storage
ENV JSON_DB_PATH=/data/db/db.json

USER bun
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:3000/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "run", "src/index.ts"]
