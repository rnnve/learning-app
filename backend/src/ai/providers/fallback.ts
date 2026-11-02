import { AppError } from "../../lib/errors.ts";
import type { GenerationProvider, GenerationResult } from "./types.ts";

export class FallbackGenerationProvider implements GenerationProvider {
  constructor(
    private primary: GenerationProvider,
    private fallback: GenerationProvider,
    private primaryTimeoutMs: number,
  ) {}

  async generateJson<T = unknown>(
    req: Parameters<GenerationProvider["generateJson"]>[0],
    opts: { signal: AbortSignal },
  ): Promise<GenerationResult<T>> {
    if (opts.signal.aborted)
      throw new AppError("AI_TIMEOUT", { message: "Generation was canceled" });
    const controller = new AbortController();
    const signal = AbortSignal.any([opts.signal, controller.signal]);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: () => void = () => {};
    try {
      return await Promise.race([
        this.primary.generateJson<T>(req, { signal }),
        new Promise<never>((_resolve, reject) => {
          onAbort = () =>
            reject(
              new AppError("AI_TIMEOUT", {
                message: "Primary generation timed out or was canceled",
              }),
            );
          signal.addEventListener("abort", onAbort, { once: true });
          timer = setTimeout(() => controller.abort(), this.primaryTimeoutMs);
          if (signal.aborted) onAbort();
        }),
      ]);
    } catch (error) {
      if (opts.signal.aborted)
        throw new AppError("AI_TIMEOUT", { message: "Generation was canceled" });
      if (
        !(error instanceof AppError) ||
        !["AI_PROVIDER_UNAVAILABLE", "AI_TIMEOUT", "AI_NOT_CONFIGURED"].includes(error.code)
      )
        throw error;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      controller.abort();
    }
    return this.fallback.generateJson<T>(req, opts);
  }
}
