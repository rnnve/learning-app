import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { Elysia } from "elysia";
import { env } from "./config/env.ts";
import { errorsPlugin } from "./plugins/errors.ts";
import { rateLimitPlugin } from "./plugins/rate-limit.ts";
import { requestIdPlugin } from "./plugins/request-id.ts";
import { securityHeadersPlugin } from "./plugins/security-headers.ts";
import { authRoutes } from "./routes/auth.ts";
import { conversationRoutes } from "./routes/conversations.ts";
import { healthRoutes } from "./routes/health.ts";
import { homeRoutes } from "./routes/home.ts";
import { jobRoutes } from "./routes/jobs.ts";
import { materialRoutes } from "./routes/materials.ts";
import { meRoutes } from "./routes/me.ts";
import { metaRoutes } from "./routes/meta.ts";
import { sourceRoutes } from "./routes/sources.ts";
import { studyRoutes } from "./routes/study.ts";

export function createServerApp() {
  const app = new Elysia();

  // Security headers & Request-ID
  app.use(requestIdPlugin);
  app.use(securityHeadersPlugin);
  app.use(rateLimitPlugin);
  app.use(errorsPlugin);

  // CORS
  if (env.CORS_ORIGINS) {
    const origins = env.CORS_ORIGINS.split(",").map((o) => o.trim());
    app.use(cors({ origin: origins }));
  } else {
    app.use(cors());
  }

  // Swagger / OpenAPI documentation
  if (env.DOCS_ENABLED) {
    app.use(
      swagger({
        path: "/docs",
        documentation: {
          info: {
            title: "Thai AI Study API",
            description: "Production API for Thai-First AI Learning Application",
            version: "1.0.0",
          },
          tags: [
            { name: "System", description: "Health and readiness checks" },
            { name: "Meta", description: "Metadata and limits" },
            { name: "Auth", description: "Authentication and session management" },
            { name: "User", description: "User profile and consent" },
            { name: "Home", description: "Home dashboard feed" },
            { name: "Sources", description: "Document and image sources" },
            { name: "Materials", description: "AI-generated study materials" },
            { name: "Jobs", description: "Background async processing jobs" },
            { name: "Chat", description: "Tutor conversations and messaging" },
            { name: "Study", description: "Flashcards and quiz study sessions" },
          ],
          components: {
            securitySchemes: {
              bearerAuth: {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT",
              },
            },
          },
        },
      }),
    );
  }

  // Mount routes
  app.use(healthRoutes);
  app.use(metaRoutes);
  app.use(authRoutes);
  app.use(meRoutes);
  app.use(homeRoutes);
  app.use(sourceRoutes);
  app.use(materialRoutes);
  app.use(jobRoutes);
  app.use(conversationRoutes);
  app.use(studyRoutes);

  return app;
}
