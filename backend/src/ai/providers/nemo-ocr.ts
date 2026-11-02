import { env } from "../../config/env.ts";
import { AppError } from "../../lib/errors.ts";
import { detectLanguage } from "../../processing/language.ts";
import type { ExtractionOutput } from "../schemas/extraction.ts";
import type { ExtractionProvider } from "./types.ts";

// The NEMOTRON_* settings are retained for compatibility with existing deployments.
export class NemoRetrieverOcrProvider implements ExtractionProvider {
  constructor(private options: { baseUrl?: string; apiKey?: string; timeoutMs?: number } = {}) {}

  async extractPage(
    input: Parameters<ExtractionProvider["extractPage"]>[0],
    opts: { signal: AbortSignal },
  ): Promise<ExtractionOutput> {
    const url = this.options.baseUrl ?? env.NEMOTRON_BASE_URL;
    const apiKey = this.options.apiKey ?? env.NEMOTRON_API_KEY;
    if (!url || !apiKey) {
      throw new AppError("AI_NOT_CONFIGURED", {
        message: "NeMo Retriever OCR endpoint and API key are required",
      });
    }

    const signal = AbortSignal.any([
      opts.signal,
      AbortSignal.timeout(this.options.timeoutMs ?? env.NEMOTRON_TIMEOUT_MS),
    ]);
    const body = JSON.stringify({
      input: [
        {
          type: "image_url",
          url: `data:${input.mime};base64,${Buffer.from(input.image).toString("base64")}`,
        },
      ],
      merge_levels: ["paragraph"],
    });

    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        signal.throwIfAborted();
        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body,
          signal,
        });
        if (!response.ok) {
          if ((response.status === 429 || response.status >= 500) && attempt < 2) {
            await response.body?.cancel();
            await new Promise<void>((resolve, reject) => {
              const onAbort = () => {
                clearTimeout(timer);
                reject(signal.reason);
              };
              const timer = setTimeout(
                () => {
                  signal.removeEventListener("abort", onAbort);
                  resolve();
                },
                1000 * 2 ** attempt,
              );
              signal.addEventListener("abort", onAbort, { once: true });
              if (signal.aborted) onAbort();
            });
            continue;
          }
          throw new AppError("AI_PROVIDER_UNAVAILABLE", {
            message: `NeMo Retriever OCR API failed with status ${response.status}`,
            details: { status: response.status },
          });
        }
        let data: unknown;
        try {
          data = await response.json();
        } catch {
          throw new AppError("AI_OUTPUT_INVALID", {
            message: "NeMo Retriever OCR returned invalid JSON",
          });
        }
        return parseOcrResponse(data);
      }
      throw new AppError("AI_PROVIDER_UNAVAILABLE", {
        message: "NeMo Retriever OCR failed after retries",
      });
    } catch (error) {
      if (signal.aborted)
        throw new AppError("AI_TIMEOUT", {
          message: "NeMo Retriever OCR request timed out or was canceled",
        });
      if (error instanceof AppError) throw error;
      throw new AppError("AI_PROVIDER_UNAVAILABLE", {
        message: "NeMo Retriever OCR network request failed",
      });
    }
  }
}

export function parseOcrResponse(value: unknown): ExtractionOutput {
  const data = value as {
    data?: { text_detections?: { text_prediction?: { text?: unknown; confidence?: unknown } }[] }[];
  };
  const detections = data?.data?.[0]?.text_detections;
  if (
    !Array.isArray(detections) ||
    detections.some((item) => typeof item?.text_prediction?.text !== "string")
  ) {
    throw new AppError("AI_OUTPUT_INVALID", {
      message: "NeMo Retriever OCR returned an invalid text-detection response",
    });
  }
  const predictions = detections.map((item) => item.text_prediction!);
  const blocks: ExtractionOutput["blocks"] = predictions
    .filter((item) => (item.text as string).trim())
    .map((item) => ({ type: "paragraph", text: (item.text as string).trim() }));
  const scores = predictions
    .map((item) => item.confidence)
    .filter(
      (score): score is number =>
        typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 1,
    );
  const mean = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
  const legibility = !blocks.length
    ? "unreadable"
    : mean === null
      ? "fair"
      : mean >= 0.9
        ? "good"
        : mean >= 0.7
          ? "fair"
          : "poor";
  return {
    language: detectLanguage(blocks.map((block) => block.text).join("\n\n")),
    legibility,
    blocks,
    warnings: legibility === "poor" ? ["OCR_LOW_CONFIDENCE"] : [],
  };
}
