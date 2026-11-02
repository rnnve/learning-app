import { GoogleGenAI } from "@google/genai";
import type { TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { env } from "../../config/env.ts";
import { AppError } from "../../lib/errors.ts";
import type { GenerationProvider, GenerationResult } from "./types.ts";

export class GeminiGenerationProvider implements GenerationProvider {
  private apiKey: string;
  private model: string;
  private client: GoogleGenAI | null = null;

  constructor(options?: { apiKey?: string; model?: string }) {
    this.apiKey = options?.apiKey || env.GEMINI_API_KEY || "";
    this.model = options?.model || env.GEMINI_MODEL || "";

    if (this.apiKey) {
      try {
        this.client = new GoogleGenAI({ apiKey: this.apiKey });
      } catch {
        // Will fail cleanly on request if bad config
      }
    }
  }

  public async generateJson<T = unknown>(
    req: {
      system: string;
      user: string;
      schema: TSchema;
      schemaName: string;
      temperature?: number;
      maxOutputTokens?: number;
    },
    opts: { signal: AbortSignal },
  ): Promise<GenerationResult<T>> {
    if (!this.apiKey || !this.model) {
      const missing: string[] = [];
      if (!this.apiKey) missing.push("GEMINI_API_KEY");
      if (!this.model) missing.push("GEMINI_MODEL");
      throw new AppError("AI_NOT_CONFIGURED", {
        message: "Gemini generation credentials are not configured",
        details: { missing },
      });
    }

    if (!this.client) {
      this.client = new GoogleGenAI({ apiKey: this.apiKey });
    }

    const temperature = req.temperature ?? 0.3;
    const maxOutputTokens = req.maxOutputTokens ?? 8192;

    const maxRetries = 2;
    let attempt = 0;

    while (attempt <= maxRetries) {
      if (opts.signal.aborted) {
        throw new AppError("AI_TIMEOUT", { message: "Gemini request timed out" });
      }

      try {
        const response = await this.client.models.generateContent({
          model: this.model,
          contents: [
            {
              role: "user",
              parts: [{ text: req.user }],
            },
          ],
          config: {
            abortSignal: AbortSignal.any([opts.signal, AbortSignal.timeout(env.GEMINI_TIMEOUT_MS)]),
            systemInstruction: req.system,
            temperature,
            maxOutputTokens,
            responseMimeType: "application/json",
          },
        });

        const rawText = response.text || "";
        const usage = (response as any).usageMetadata;

        const cleanedJson = stripFences(rawText);
        let parsed: any;
        try {
          parsed = JSON.parse(cleanedJson);
        } catch (jsonErr: any) {
          throw new AppError("AI_OUTPUT_INVALID", {
            message: `Failed to parse Gemini output as JSON: ${jsonErr.message}`,
          });
        }

        if (!Value.Check(req.schema, parsed)) {
          const errors = [...Value.Errors(req.schema, parsed)].map(
            (e) => `${e.path}: ${e.message}`,
          );
          throw new AppError("AI_OUTPUT_INVALID", {
            message: `Gemini JSON output did not match schema: ${errors.join(", ")}`,
            details: { errors },
          });
        }

        return {
          data: parsed as T,
          raw: rawText,
          usage,
          generation: { provider: "gemini", model: this.model },
        };
      } catch (err: any) {
        if (err instanceof AppError) throw err;

        if (err.name === "AbortError" || opts.signal.aborted) {
          throw new AppError("AI_TIMEOUT", { message: "Gemini request timed out" });
        }

        const msg = String(err.message || "").toLowerCase();
        if (msg.includes("safety") || msg.includes("blocked")) {
          throw new AppError("AI_CONTENT_BLOCKED", {
            message: "Gemini content safety blocked response",
          });
        }

        if (msg.includes("quota") || msg.includes("rate limit") || msg.includes("429")) {
          if (attempt < maxRetries) {
            attempt++;
            await Bun.sleep(1000 * 2 ** attempt + Math.random() * 500);
            continue;
          }
          throw new AppError("AI_PROVIDER_UNAVAILABLE", {
            message: "Gemini quota or rate limit exceeded",
          });
        }

        if (
          msg.includes("500") ||
          msg.includes("503") ||
          msg.includes("network") ||
          msg.includes("fetch")
        ) {
          if (attempt < maxRetries) {
            attempt++;
            await Bun.sleep(1000 * 2 ** attempt + Math.random() * 500);
            continue;
          }
          throw new AppError("AI_PROVIDER_UNAVAILABLE", {
            message: `Gemini provider unavailable: ${err.message}`,
          });
        }

        throw new AppError("AI_PROVIDER_UNAVAILABLE", {
          message: `Gemini request failed: ${err.message}`,
        });
      }
    }

    throw new AppError("AI_PROVIDER_UNAVAILABLE", {
      message: "Gemini request failed after retries",
    });
  }
}

function stripFences(raw: string): string {
  let text = raw.trim();
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    text = match[1].trim();
  }
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return text.substring(first, last + 1);
  }
  return text;
}
