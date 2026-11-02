import type { TSchema } from "@sinclair/typebox";
import type { ExtractionOutput } from "../schemas/extraction.ts";

export interface ExtractionProvider {
  extractPage(
    input: {
      image: Uint8Array;
      mime: string;
      pageHint?: number;
      languageHint?: "th" | "en";
    },
    opts: { signal: AbortSignal },
  ): Promise<ExtractionOutput>;
}

export interface GenerationResult<T> {
  data: T;
  raw: string;
  usage?: Record<string, any>;
  generation?: { provider: "gemini" | "nemotron"; model: string };
}

export interface GenerationProvider {
  generateJson<T = unknown>(
    req: {
      system: string;
      user: string;
      schema: TSchema;
      schemaName: string;
      temperature?: number;
      maxOutputTokens?: number;
    },
    opts: { signal: AbortSignal },
  ): Promise<GenerationResult<T>>;
}
