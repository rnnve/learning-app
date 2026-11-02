import { env } from "../../config/env.ts";
import { AppError } from "../../lib/errors.ts";
import { FakeExtractionProvider, FakeGenerationProvider } from "./fake.ts";
import { FallbackGenerationProvider } from "./fallback.ts";
import { GeminiGenerationProvider } from "./gemini.ts";
import { NemoRetrieverOcrProvider } from "./nemo-ocr.ts";
import { NemotronGenerationProvider } from "./nemotron-generation.ts";
import { NemotronExtractionProvider } from "./nemotron.ts";
import type { ExtractionProvider, GenerationProvider } from "./types.ts";

export function getExtractionProvider(): ExtractionProvider {
  if (env.AI_MODE === "disabled") {
    return {
      extractPage: async () => {
        throw new AppError("AI_NOT_CONFIGURED", {
          message: "AI extraction is disabled in configuration",
        });
      },
    };
  }

  if (env.AI_MODE === "fixture") {
    return new FakeExtractionProvider();
  }

  return env.NEMOTRON_MODEL === "nemoretriever-ocr-v1"
    ? new NemoRetrieverOcrProvider()
    : new NemotronExtractionProvider();
}

export function getGenerationProvider(): GenerationProvider {
  if (env.AI_MODE === "disabled") {
    return {
      generateJson: async () => {
        throw new AppError("AI_NOT_CONFIGURED", {
          message: "AI generation is disabled in configuration",
        });
      },
    };
  }

  if (env.AI_MODE === "fixture") {
    return new FakeGenerationProvider();
  }

  return new FallbackGenerationProvider(
    new GeminiGenerationProvider(),
    new NemotronGenerationProvider(),
    env.GENERATION_PRIMARY_TIMEOUT_MS,
  );
}
