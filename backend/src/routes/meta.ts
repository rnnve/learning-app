import { Elysia } from "elysia";
import { PROMPT_VERSION } from "../ai/prompts/system.v1.ts";
import { env } from "../config/env.ts";

export const metaRoutes = new Elysia({ prefix: "/v1" }).get(
  "/meta",
  () => {
    return {
      apiVersion: "1",
      promptVersion: PROMPT_VERSION,
      limits: {
        maxImageBytes: env.MAX_IMAGE_BYTES,
        maxDocumentBytes: env.MAX_DOCUMENT_BYTES,
        maxImagesPerSource: env.MAX_IMAGES_PER_SOURCE,
        maxPdfPages: env.MAX_PDF_PAGES,
        maxChatMessageChars: 4000,
        maxGenerationsPerDay: env.MAX_GENERATIONS_PER_DAY,
        maxChatMessagesPerDay: env.MAX_CHAT_MESSAGES_PER_DAY,
      },
      supported: {
        imageMimeTypes: ["image/jpeg", "image/png", "image/webp"],
        documentMimeTypes: [
          "text/plain",
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
      },
      ai: {
        extraction: env.AI_MODE,
        generation: env.AI_MODE,
      },
      consentVersion: env.CONSENT_VERSION,
    };
  },
  {
    detail: {
      tags: ["Meta"],
      summary: "System metadata and limits",
    },
  },
);
