import { lt, lte } from "drizzle-orm";
import { createServerApp } from "./app.ts";
import { env } from "./config/env.ts";
import { getDb, schema } from "./db/client.ts";
import { logger } from "./lib/logger.ts";
import { worker } from "./worker/loop.ts";

async function runHousekeeping() {
  try {
    const db = getDb();
    const now = new Date();

    // 1. Delete expired idempotency keys (older than 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await db.delete(schema.idempotencyKeys).where(lt(schema.idempotencyKeys.createdAt, oneDayAgo));

    // 2. Delete expired refresh tokens
    await db.delete(schema.refreshTokens).where(lte(schema.refreshTokens.expiresAt, now));

    logger.info("Housekeeping cycle completed");
  } catch (err: any) {
    logger.warn("Housekeeping failed", { error: err.message });
  }
}

async function bootstrap() {
  logger.info("Booting Thai AI Study API server...", {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    aiMode: env.AI_MODE,
  });

  // Run initial housekeeping
  await runHousekeeping();

  // Hourly housekeeping interval
  setInterval(runHousekeeping, 60 * 60 * 1000);

  // Start background worker if enabled
  if (env.WORKER_ENABLED) {
    worker.start();
  }

  const app = createServerApp();
  app.listen(env.PORT, () => {
    logger.info(`Server listening on ${env.PUBLIC_BASE_URL} (Port ${env.PORT})`);
    if (env.DOCS_ENABLED) {
      logger.info(`Swagger documentation available at ${env.PUBLIC_BASE_URL}/docs`);
    }
  });

  // Graceful shutdown
  const shutdown = () => {
    logger.info("Shutting down server...");
    worker.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

bootstrap().catch((err) => {
  logger.error("Failed to start server", { error: err.message, stack: err.stack });
  process.exit(1);
});
