import { type Static, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

export const EnvSchema = Type.Object({
  NODE_ENV: Type.Union(
    [Type.Literal("development"), Type.Literal("production"), Type.Literal("test")],
    { default: "development" },
  ),
  PORT: Type.Number({ default: 3000 }),
  PUBLIC_BASE_URL: Type.String({ default: "http://localhost:3000" }),
  DATABASE_URL: Type.Optional(Type.String()),
  JSON_DB_PATH: Type.String({ default: "./data/db.json" }),
  JWT_SECRET: Type.String({ minLength: 32 }),
  ACCESS_TOKEN_TTL_SEC: Type.Number({ default: 900 }),
  REFRESH_TOKEN_TTL_DAYS: Type.Number({ default: 30 }),
  STORAGE_DIR: Type.String({ default: "/data/storage" }),
  DOCS_ENABLED: Type.Boolean({ default: true }),
  CORS_ORIGINS: Type.String({ default: "" }),
  CONSENT_VERSION: Type.String({ default: "2026-10-v1" }),

  // AI Mode
  AI_MODE: Type.Union([Type.Literal("live"), Type.Literal("fixture"), Type.Literal("disabled")], {
    default: "live",
  }),

  // Nemotron
  NEMOTRON_BASE_URL: Type.Optional(Type.String()),
  NEMOTRON_API_KEY: Type.Optional(Type.String()),
  NEMOTRON_MODEL: Type.String({ default: "nemotron-3-nano-omni-30b-a3b-reasoning" }),
  NEMOTRON_TIMEOUT_MS: Type.Number({ default: 90000 }),
  NEMOTRON_MAX_OUTPUT_TOKENS: Type.Number({ default: 8192 }),
  NEMOTRON_REASONING: Type.Optional(Type.String()),

  // Gemini
  GEMINI_API_KEY: Type.Optional(Type.String()),
  GEMINI_MODEL: Type.Optional(Type.String()),
  GEMINI_TIMEOUT_MS: Type.Number({ default: 90000 }),
  GEMINI_THINKING_LEVEL: Type.Optional(Type.String()),

  // Content generation fallback (uses NEMOTRON_API_KEY when no separate key is set).
  NEMOTRON_GENERATION_BASE_URL: Type.String({ default: "https://integrate.api.nvidia.com/v1" }),
  NEMOTRON_GENERATION_API_KEY: Type.Optional(Type.String()),
  NEMOTRON_GENERATION_MODEL: Type.String({ default: "nvidia/nemotron-3.5-lightning-30b-a3b" }),
  GENERATION_PRIMARY_TIMEOUT_MS: Type.Number({ default: 30000, minimum: 1 }),
  NEMOTRON_GENERATION_TIMEOUT_MS: Type.Number({ default: 60000, minimum: 1 }),

  // Limits
  MAX_IMAGE_BYTES: Type.Number({ default: 10 * 1024 * 1024 }),
  MAX_DOCUMENT_BYTES: Type.Number({ default: 25 * 1024 * 1024 }),
  MAX_IMAGES_PER_SOURCE: Type.Number({ default: 10 }),
  MAX_PDF_PAGES: Type.Number({ default: 100 }),
  OCR_PAGE_CAP: Type.Number({ default: 40 }),
  MAX_EXTRACTED_CHARS: Type.Number({ default: 1500000 }),
  MAX_GENERATIONS_PER_DAY: Type.Number({ default: 30 }),
  MAX_CHAT_MESSAGES_PER_DAY: Type.Number({ default: 200 }),
  RATE_LIMIT_GENERAL_PER_MIN: Type.Number({ default: 120 }),
  RATE_LIMIT_AUTH_PER_MIN: Type.Number({ default: 10 }),
  CHUNK_TARGET_CHARS: Type.Number({ default: 3500 }),
  CHUNK_OVERLAP_CHARS: Type.Number({ default: 300 }),
  DIRECT_CONTEXT_CHAR_BUDGET: Type.Number({ default: 60000 }),
  WORKER_ENABLED: Type.Boolean({ default: true }),
  WORKER_CONCURRENCY: Type.Number({ default: 2 }),
});

export type Env = Static<typeof EnvSchema>;

export function loadEnv(rawEnv: Record<string, string | undefined> = process.env): Env {
  const parsed: Record<string, any> = {
    NODE_ENV: rawEnv.NODE_ENV || "development",
    PORT: rawEnv.PORT ? Number.parseInt(rawEnv.PORT, 10) : 3000,
    PUBLIC_BASE_URL: rawEnv.PUBLIC_BASE_URL || "http://localhost:3000",
    DATABASE_URL: rawEnv.DATABASE_URL || undefined,
    JSON_DB_PATH: rawEnv.JSON_DB_PATH || "./data/db.json",
    JWT_SECRET:
      rawEnv.JWT_SECRET ||
      (rawEnv.NODE_ENV === "test" ? "test-secret-at-least-32-characters-long!!" : ""),
    ACCESS_TOKEN_TTL_SEC: rawEnv.ACCESS_TOKEN_TTL_SEC
      ? Number.parseInt(rawEnv.ACCESS_TOKEN_TTL_SEC, 10)
      : 900,
    REFRESH_TOKEN_TTL_DAYS: rawEnv.REFRESH_TOKEN_TTL_DAYS
      ? Number.parseInt(rawEnv.REFRESH_TOKEN_TTL_DAYS, 10)
      : 30,
    STORAGE_DIR:
      rawEnv.STORAGE_DIR ||
      (rawEnv.NODE_ENV === "test" ? "/tmp/thaistudy-storage" : "./data/storage"),
    DOCS_ENABLED:
      rawEnv.DOCS_ENABLED !== undefined
        ? rawEnv.DOCS_ENABLED === "true"
        : rawEnv.NODE_ENV !== "production",
    CORS_ORIGINS: rawEnv.CORS_ORIGINS || "",
    CONSENT_VERSION: rawEnv.CONSENT_VERSION || "2026-10-v1",

    AI_MODE: rawEnv.AI_MODE || "live",
    NEMOTRON_BASE_URL: rawEnv.NEMOTRON_BASE_URL || undefined,
    NEMOTRON_API_KEY: rawEnv.NEMOTRON_API_KEY || undefined,
    NEMOTRON_MODEL: rawEnv.NEMOTRON_MODEL || "nemotron-3-nano-omni-30b-a3b-reasoning",
    NEMOTRON_TIMEOUT_MS: rawEnv.NEMOTRON_TIMEOUT_MS
      ? Number.parseInt(rawEnv.NEMOTRON_TIMEOUT_MS, 10)
      : 90000,
    NEMOTRON_MAX_OUTPUT_TOKENS: rawEnv.NEMOTRON_MAX_OUTPUT_TOKENS
      ? Number.parseInt(rawEnv.NEMOTRON_MAX_OUTPUT_TOKENS, 10)
      : 8192,
    NEMOTRON_REASONING: rawEnv.NEMOTRON_REASONING || undefined,

    GEMINI_API_KEY: rawEnv.GEMINI_API_KEY || undefined,
    GEMINI_MODEL: rawEnv.GEMINI_MODEL || undefined,
    GEMINI_TIMEOUT_MS: rawEnv.GEMINI_TIMEOUT_MS
      ? Number.parseInt(rawEnv.GEMINI_TIMEOUT_MS, 10)
      : 90000,
    GEMINI_THINKING_LEVEL: rawEnv.GEMINI_THINKING_LEVEL || undefined,

    NEMOTRON_GENERATION_BASE_URL:
      rawEnv.NEMOTRON_GENERATION_BASE_URL || "https://integrate.api.nvidia.com/v1",
    NEMOTRON_GENERATION_API_KEY: rawEnv.NEMOTRON_GENERATION_API_KEY || undefined,
    NEMOTRON_GENERATION_MODEL:
      rawEnv.NEMOTRON_GENERATION_MODEL || "nvidia/nemotron-3.5-lightning-30b-a3b",
    GENERATION_PRIMARY_TIMEOUT_MS: Number(rawEnv.GENERATION_PRIMARY_TIMEOUT_MS || 30000),
    NEMOTRON_GENERATION_TIMEOUT_MS: Number(rawEnv.NEMOTRON_GENERATION_TIMEOUT_MS || 60000),

    MAX_IMAGE_BYTES: rawEnv.MAX_IMAGE_BYTES
      ? Number.parseInt(rawEnv.MAX_IMAGE_BYTES, 10)
      : 10 * 1024 * 1024,
    MAX_DOCUMENT_BYTES: rawEnv.MAX_DOCUMENT_BYTES
      ? Number.parseInt(rawEnv.MAX_DOCUMENT_BYTES, 10)
      : 25 * 1024 * 1024,
    MAX_IMAGES_PER_SOURCE: rawEnv.MAX_IMAGES_PER_SOURCE
      ? Number.parseInt(rawEnv.MAX_IMAGES_PER_SOURCE, 10)
      : 10,
    MAX_PDF_PAGES: rawEnv.MAX_PDF_PAGES ? Number.parseInt(rawEnv.MAX_PDF_PAGES, 10) : 100,
    OCR_PAGE_CAP: rawEnv.OCR_PAGE_CAP ? Number.parseInt(rawEnv.OCR_PAGE_CAP, 10) : 40,
    MAX_EXTRACTED_CHARS: rawEnv.MAX_EXTRACTED_CHARS
      ? Number.parseInt(rawEnv.MAX_EXTRACTED_CHARS, 10)
      : 1500000,
    MAX_GENERATIONS_PER_DAY: rawEnv.MAX_GENERATIONS_PER_DAY
      ? Number.parseInt(rawEnv.MAX_GENERATIONS_PER_DAY, 10)
      : 30,
    MAX_CHAT_MESSAGES_PER_DAY: rawEnv.MAX_CHAT_MESSAGES_PER_DAY
      ? Number.parseInt(rawEnv.MAX_CHAT_MESSAGES_PER_DAY, 10)
      : 200,
    RATE_LIMIT_GENERAL_PER_MIN: rawEnv.RATE_LIMIT_GENERAL_PER_MIN
      ? Number.parseInt(rawEnv.RATE_LIMIT_GENERAL_PER_MIN, 10)
      : 120,
    RATE_LIMIT_AUTH_PER_MIN: rawEnv.RATE_LIMIT_AUTH_PER_MIN
      ? Number.parseInt(rawEnv.RATE_LIMIT_AUTH_PER_MIN, 10)
      : 10,
    CHUNK_TARGET_CHARS: rawEnv.CHUNK_TARGET_CHARS
      ? Number.parseInt(rawEnv.CHUNK_TARGET_CHARS, 10)
      : 3500,
    CHUNK_OVERLAP_CHARS: rawEnv.CHUNK_OVERLAP_CHARS
      ? Number.parseInt(rawEnv.CHUNK_OVERLAP_CHARS, 10)
      : 300,
    DIRECT_CONTEXT_CHAR_BUDGET: rawEnv.DIRECT_CONTEXT_CHAR_BUDGET
      ? Number.parseInt(rawEnv.DIRECT_CONTEXT_CHAR_BUDGET, 10)
      : 60000,
    WORKER_ENABLED: rawEnv.WORKER_ENABLED !== undefined ? rawEnv.WORKER_ENABLED === "true" : true,
    WORKER_CONCURRENCY: rawEnv.WORKER_CONCURRENCY
      ? Number.parseInt(rawEnv.WORKER_CONCURRENCY, 10)
      : 2,
  };

  const errors = [...Value.Errors(EnvSchema, parsed)];
  if (errors.length > 0) {
    const errorMsgs = errors.map((e) => `  - ${e.path.replace(/^\//, "")}: ${e.message}`);
    throw new Error(`Environment configuration invalid:\n${errorMsgs.join("\n")}`);
  }

  if (parsed.AI_MODE === "fixture" && parsed.NODE_ENV === "production") {
    throw new Error("AI_MODE=fixture is forbidden when NODE_ENV=production");
  }

  return parsed as Env;
}

export const env = loadEnv();
