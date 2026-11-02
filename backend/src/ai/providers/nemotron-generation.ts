import { Value } from "@sinclair/typebox/value";
import { env } from "../../config/env.ts";
import { AppError } from "../../lib/errors.ts";
import { stripReasoningAndExtractJson } from "./nemotron.ts";
import type { GenerationProvider, GenerationResult } from "./types.ts";

export class NemotronGenerationProvider implements GenerationProvider {
  constructor(
    private options: { baseUrl?: string; apiKey?: string; model?: string; timeoutMs?: number } = {},
  ) {}

  async generateJson<T = unknown>(
    req: Parameters<GenerationProvider["generateJson"]>[0],
    opts: { signal: AbortSignal },
  ): Promise<GenerationResult<T>> {
    const apiKey = this.options.apiKey ?? env.NEMOTRON_GENERATION_API_KEY ?? env.NEMOTRON_API_KEY;
    const model = this.options.model ?? env.NEMOTRON_GENERATION_MODEL;
    if (!apiKey)
      throw new AppError("AI_NOT_CONFIGURED", {
        message: "Nemotron generation API key is missing",
      });
    const signal = AbortSignal.any([
      opts.signal,
      AbortSignal.timeout(this.options.timeoutMs ?? env.NEMOTRON_GENERATION_TIMEOUT_MS),
    ]);
    try {
      const response = await fetch(
        `${(this.options.baseUrl ?? env.NEMOTRON_GENERATION_BASE_URL).replace(/\/+$/, "")}/chat/completions`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            stream: false,
            temperature: req.temperature ?? 0.3,
            max_tokens: req.maxOutputTokens ?? 8192,
            chat_template_kwargs: { enable_thinking: false },
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content: `${req.system}\nReturn JSON only matching this schema (${req.schemaName}):\n${JSON.stringify(req.schema)}`,
              },
              { role: "user", content: req.user },
            ],
          }),
          signal,
        },
      );
      if (!response.ok)
        throw new AppError("AI_PROVIDER_UNAVAILABLE", {
          message: `Nemotron generation API failed with status ${response.status}`,
          details: { status: response.status },
        });
      let output: any;
      let parsed: unknown;
      let raw: string;
      try {
        output = await response.json();
        const choice = output.choices?.[0];
        if (choice?.finish_reason === "content_filter") throw new AppError("AI_CONTENT_BLOCKED");
        raw = choice?.message?.content;
        if (typeof raw !== "string" || choice?.finish_reason === "length")
          throw new Error("Missing or truncated content");
        parsed = JSON.parse(stripReasoningAndExtractJson(raw));
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError("AI_OUTPUT_INVALID", {
          message: "Nemotron generation returned invalid JSON",
        });
      }
      if (!Value.Check(req.schema, parsed))
        throw new AppError("AI_OUTPUT_INVALID", {
          message: "Nemotron generation output did not match the requested schema",
        });
      return {
        data: parsed as T,
        raw,
        usage: output.usage,
        generation: { provider: "nemotron", model },
      };
    } catch (error) {
      if (signal.aborted)
        throw new AppError("AI_TIMEOUT", {
          message: "Nemotron generation timed out or was canceled",
        });
      if (error instanceof AppError) throw error;
      throw new AppError("AI_PROVIDER_UNAVAILABLE", {
        message: "Nemotron generation network request failed",
      });
    }
  }
}
