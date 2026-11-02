import { Value } from "@sinclair/typebox/value";
import { env } from "../../config/env.ts";
import { AppError } from "../../lib/errors.ts";
import { EXTRACTION_PROMPT_V1 } from "../prompts/extraction.v1.ts";
import type { ExtractionOutput } from "../schemas/extraction.ts";
import { ExtractionSchema } from "../schemas/extraction.ts";
import type { ExtractionProvider } from "./types.ts";

export class NemotronExtractionProvider implements ExtractionProvider {
  private baseUrl: string;
  private apiKey: string;
  private model: string;
  private maxTokens: number;

  constructor(options?: {
    baseUrl?: string;
    apiKey?: string;
    model?: string;
    maxTokens?: number;
  }) {
    this.baseUrl = options?.baseUrl || env.NEMOTRON_BASE_URL || "";
    this.apiKey = options?.apiKey || env.NEMOTRON_API_KEY || "";
    this.model = options?.model || env.NEMOTRON_MODEL;
    this.maxTokens = options?.maxTokens || env.NEMOTRON_MAX_OUTPUT_TOKENS;

    if (!this.baseUrl || !this.apiKey) {
      // Don't throw at instancing; throw on usage if unconfigured
    }
  }

  public async extractPage(
    input: {
      image: Uint8Array;
      mime: string;
      pageHint?: number;
      languageHint?: "th" | "en";
    },
    opts: { signal: AbortSignal },
  ): Promise<ExtractionOutput> {
    if (!this.baseUrl || !this.apiKey) {
      throw new AppError("AI_NOT_CONFIGURED", {
        message: "Nemotron credentials are not configured",
        details: {
          missing: ["NEMOTRON_BASE_URL", "NEMOTRON_API_KEY"].filter((k) => !process.env[k]),
        },
      });
    }

    const base64Data = Buffer.from(input.image).toString("base64");
    const dataUri = `data:${input.mime};base64,${base64Data}`;

    const url = `${this.baseUrl.replace(/\/+$/, "")}/chat/completions`;

    const requestBody = {
      model: this.model,
      temperature: 0,
      max_tokens: this.maxTokens,
      messages: [
        {
          role: "system",
          content: EXTRACTION_PROMPT_V1,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Please transcribe this page (Page ${input.pageHint ?? 1}) according to the schema.`,
            },
            {
              type: "image_url",
              image_url: {
                url: dataUri,
              },
            },
          ],
        },
      ],
    };

    const rawOutput = await this.callWithRetry(url, requestBody, opts.signal);
    const cleanedJson = stripReasoningAndExtractJson(rawOutput);

    try {
      const parsed = JSON.parse(cleanedJson);
      if (Value.Check(ExtractionSchema, parsed)) {
        return parsed;
      }
      // Attempt 1 repair
      const repaired = await this.repairExtraction(cleanedJson, opts.signal);
      if (Value.Check(ExtractionSchema, repaired)) {
        return repaired;
      }
    } catch {
      // Fallback repair attempt
      const repaired = await this.repairExtraction(rawOutput, opts.signal);
      if (Value.Check(ExtractionSchema, repaired)) {
        return repaired;
      }
    }

    throw new AppError("AI_OUTPUT_INVALID", {
      message: "Nemotron vision OCR failed to return valid schema output after repair",
    });
  }

  private async repairExtraction(badJson: string, signal: AbortSignal): Promise<any> {
    const url = `${this.baseUrl.replace(/\/+$/, "")}/chat/completions`;
    const repairBody = {
      model: this.model,
      temperature: 0,
      max_tokens: this.maxTokens,
      messages: [
        {
          role: "system",
          content: `${EXTRACTION_PROMPT_V1}\nFix the following invalid JSON so it conforms strictly to the schema. Return JSON only without fences.`,
        },
        {
          role: "user",
          content: badJson.slice(0, 4000),
        },
      ],
    };
    const raw = await this.callWithRetry(url, repairBody, signal);
    const cleaned = stripReasoningAndExtractJson(raw);
    return JSON.parse(cleaned);
  }

  private async callWithRetry(url: string, body: any, signal: AbortSignal): Promise<string> {
    const maxRetries = 2;
    let attempt = 0;

    while (attempt <= maxRetries) {
      if (signal.aborted) {
        throw new AppError("AI_TIMEOUT", { message: "AI request was aborted or timed out" });
      }

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
          signal,
        });

        if (response.status === 429) {
          const retryAfter = response.headers.get("retry-after");
          const waitMs = retryAfter
            ? Number.parseInt(retryAfter, 10) * 1000
            : 1000 * 2 ** attempt + Math.random() * 500;
          if (attempt < maxRetries) {
            attempt++;
            await Bun.sleep(waitMs);
            continue;
          }
          throw new AppError("AI_PROVIDER_UNAVAILABLE", {
            message: "Nemotron provider rate limit exceeded",
            details: { status: 429 },
          });
        }

        if (response.status >= 500) {
          if (attempt < maxRetries) {
            attempt++;
            await Bun.sleep(1000 * 2 ** attempt + Math.random() * 500);
            continue;
          }
          throw new AppError("AI_PROVIDER_UNAVAILABLE", {
            message: `Nemotron server error: ${response.status}`,
            details: { status: response.status },
          });
        }

        if (!response.ok) {
          const errorText = await response.text();
          if (response.status === 400 && errorText.includes("safety")) {
            throw new AppError("AI_CONTENT_BLOCKED", {
              message: "Nemotron safety filter triggered",
            });
          }
          throw new AppError("AI_PROVIDER_UNAVAILABLE", {
            message: `Nemotron API failed with status ${response.status}`,
            details: { status: response.status },
          });
        }

        const data: any = await response.json();
        const content = data.choices?.[0]?.message?.content || "";
        return content;
      } catch (err: any) {
        if (err instanceof AppError) throw err;
        if (err.name === "AbortError" || signal.aborted) {
          throw new AppError("AI_TIMEOUT", { message: "Nemotron request timed out" });
        }
        if (attempt < maxRetries) {
          attempt++;
          await Bun.sleep(1000 * 2 ** attempt + Math.random() * 500);
          continue;
        }
        throw new AppError("AI_PROVIDER_UNAVAILABLE", {
          message: `Nemotron network error: ${err.message}`,
        });
      }
    }

    throw new AppError("AI_PROVIDER_UNAVAILABLE", {
      message: "Nemotron provider failed after retries",
    });
  }
}

export function stripReasoningAndExtractJson(raw: string): string {
  // Discard <think>...</think> spans
  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // Strip markdown code fences if present (```json ... ```)
  const codeFenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeFenceMatch) {
    text = codeFenceMatch[1].trim();
  }

  // Find first { and matching last }
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.substring(firstBrace, lastBrace + 1);
  }

  return text;
}
