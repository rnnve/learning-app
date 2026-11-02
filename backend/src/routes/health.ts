import { Elysia, t } from "elysia";
import { env } from "../config/env.ts";
import { checkDbHealth } from "../db/client.ts";
import { storage } from "../storage/local.ts";

const startTime = Date.now();

export const healthRoutes = new Elysia()
  .get(
    "/health",
    () => {
      const uptimeSec = Math.floor((Date.now() - startTime) / 1000);
      return {
        status: "ok",
        version: "1.0.0",
        uptimeSec,
      };
    },
    {
      detail: {
        tags: ["System"],
        summary: "Service health check",
      },
    },
  )
  .get(
    "/ready",
    async ({ set }) => {
      const dbOk = await checkDbHealth();
      let storageOk = false;
      try {
        const testKey = ".healthcheck";
        await storage.saveFile(testKey, new Uint8Array([1]));
        storageOk = await storage.exists(testKey);
        await storage.deleteFile(testKey);
      } catch {
        storageOk = false;
      }

      const nemotronConfigured = !!(env.NEMOTRON_BASE_URL && env.NEMOTRON_API_KEY);
      const geminiConfigured = !!(env.GEMINI_API_KEY && env.GEMINI_MODEL);

      const isReady = dbOk && storageOk;
      if (!isReady) {
        set.status = 503;
      }

      return {
        status: isReady ? "ready" : "not_ready",
        checks: {
          database: dbOk ? "ok" : "fail",
          storage: storageOk ? "ok" : "fail",
          migrations: dbOk ? "ok" : "fail",
          nemotron: nemotronConfigured ? "configured" : "not_configured",
          gemini: geminiConfigured ? "configured" : "not_configured",
        },
      };
    },
    {
      detail: {
        tags: ["System"],
        summary: "Service readiness check",
      },
    },
  );
