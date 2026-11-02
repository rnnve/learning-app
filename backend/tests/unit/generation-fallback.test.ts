import { describe, expect, it } from "bun:test";
import { Type } from "@sinclair/typebox";
import { generateMaterial } from "../../src/ai/pipeline/generate.ts";
import { FallbackGenerationProvider } from "../../src/ai/providers/fallback.ts";
import { NemotronGenerationProvider } from "../../src/ai/providers/nemotron-generation.ts";
import type { GenerationProvider, GenerationResult } from "../../src/ai/providers/types.ts";
import { AppError } from "../../src/lib/errors.ts";

const request = {
  system: "Tutor",
  user: "Test",
  schema: Type.Object({ answer: Type.String() }),
  schemaName: "Answer",
};

function stub(
  run: (signal: AbortSignal) => Promise<GenerationResult<unknown>>,
): GenerationProvider {
  return {
    async generateJson<T>(
      _req: Parameters<GenerationProvider["generateJson"]>[0],
      opts: { signal: AbortSignal },
    ) {
      return (await run(opts.signal)) as GenerationResult<T>;
    },
  };
}

describe("Generation fallback", () => {
  it("uses Gemini when it succeeds", async () => {
    let fallbackCalls = 0;
    const primary = stub(async () => ({
      data: { answer: "Gemini" },
      raw: "{}",
      generation: { provider: "gemini", model: "primary" },
    }));
    const fallback = stub(async () => {
      fallbackCalls++;
      return { data: {}, raw: "{}" };
    });
    const result = await new FallbackGenerationProvider(primary, fallback, 100).generateJson(
      request,
      { signal: new AbortController().signal },
    );
    expect(result.generation?.provider).toBe("gemini");
    expect(fallbackCalls).toBe(0);
  });

  for (const code of ["AI_PROVIDER_UNAVAILABLE", "AI_TIMEOUT", "AI_NOT_CONFIGURED"] as const) {
    it(`switches to Nemotron on ${code}`, async () => {
      const provider = new FallbackGenerationProvider(
        stub(async () => {
          throw new AppError(code);
        }),
        stub(async () => ({
          data: { answer: "backup" },
          raw: "{}",
          generation: { provider: "nemotron", model: "lightning" },
        })),
        100,
      );
      const result = await provider.generateJson(request, { signal: new AbortController().signal });
      expect(result.generation?.provider).toBe("nemotron");
    });
  }

  for (const code of ["AI_CONTENT_BLOCKED", "AI_OUTPUT_INVALID"] as const) {
    it(`does not fall back on ${code}`, async () => {
      let calls = 0;
      const provider = new FallbackGenerationProvider(
        stub(async () => {
          throw new AppError(code);
        }),
        stub(async () => {
          calls++;
          return { data: {}, raw: "{}" };
        }),
        100,
      );
      await expect(
        provider.generateJson(request, { signal: new AbortController().signal }),
      ).rejects.toMatchObject({ code });
      expect(calls).toBe(0);
    });
  }

  it("enforces the primary deadline even if the SDK does not settle on abort", async () => {
    let signal: AbortSignal | undefined;
    const provider = new FallbackGenerationProvider(
      stub(async (received) => {
        signal = received;
        return new Promise(() => {});
      }),
      stub(async () => ({ data: { answer: "backup" }, raw: "{}" })),
      10,
    );
    const result = await provider.generateJson(request, { signal: new AbortController().signal });
    expect(result.data).toEqual({ answer: "backup" });
    expect(signal?.aborted).toBe(true);
  });

  it("stops on caller cancellation without calling the backup", async () => {
    let calls = 0;
    const controller = new AbortController();
    const provider = new FallbackGenerationProvider(
      stub(async () => new Promise(() => {})),
      stub(async () => {
        calls++;
        return { data: {}, raw: "{}" };
      }),
      1000,
    );
    const result = provider.generateJson(request, { signal: controller.signal });
    controller.abort();
    await expect(result).rejects.toMatchObject({ code: "AI_TIMEOUT" });
    expect(calls).toBe(0);
  });

  it("records the backup model on generated materials", async () => {
    const provider = stub(async () => ({
      data: { overview: "Plants", keyPoints: [], sections: [], glossary: [], limitations: [] },
      raw: "{}",
      generation: { provider: "nemotron", model: "lightning" },
    }));
    const result = await generateMaterial(
      {
        type: "summary",
        sourceId: "source",
        sourceTitle: "Plants",
        sourceLanguage: "en",
        options: {},
        chunks: [],
        userPreferences: {},
      },
      provider,
      new AbortController().signal,
    );
    expect(result.generatedBy.provider).toBe("nemotron");
    expect(result.generatedBy.model).toBe("lightning");
  });
});

describe("Nemotron generation adapter", () => {
  it("sends the text API contract and validates returned JSON", async () => {
    let received: any;
    let invalid = false;
    let path: string | undefined;
    const server = Bun.serve({
      port: 0,
      async fetch(req) {
        path = new URL(req.url).pathname;
        received = await req.json();
        return Response.json({
          choices: [
            {
              finish_reason: "stop",
              message: {
                content: invalid
                  ? '{"wrong":true}'
                  : '<think>hidden</think>```json\n{"answer":"OK"}\n```',
              },
            },
          ],
        });
      },
    });
    try {
      const provider = new NemotronGenerationProvider({
        baseUrl: `http://localhost:${server.port}/v1`,
        apiKey: "test-key",
        model: "lightning",
      });
      const result = await provider.generateJson(request, { signal: new AbortController().signal });
      expect(path).toBe("/v1/chat/completions");
      expect(received.model).toBe("lightning");
      expect(received.chat_template_kwargs.enable_thinking).toBe(false);
      expect(received.messages[0].content).toContain("Answer");
      expect(result.data).toEqual({ answer: "OK" });
      expect(result.generation).toEqual({ provider: "nemotron", model: "lightning" });
      invalid = true;
      await expect(
        provider.generateJson(request, { signal: new AbortController().signal }),
      ).rejects.toMatchObject({ code: "AI_OUTPUT_INVALID" });
      await expect(
        provider.generateJson(request, { signal: AbortSignal.abort() }),
      ).rejects.toMatchObject({ code: "AI_TIMEOUT" });
    } finally {
      server.stop();
    }
  });
});
