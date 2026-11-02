import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { NemotronExtractionProvider } from "../../src/ai/providers/nemotron.ts";
import { AppError } from "../../src/lib/errors.ts";

describe("Nemotron Provider Adapter with Mock Server", () => {
  let mockServer: any;
  let mockServerUrl: string;
  let currentResponseStatus = 200;
  let currentResponseBody: any = {};

  beforeAll(() => {
    mockServer = Bun.serve({
      port: 0,
      fetch(req) {
        if (currentResponseStatus === 429) {
          return new Response(JSON.stringify({ error: "rate limit" }), {
            status: 429,
            headers: { "Retry-After": "1", "Content-Type": "application/json" },
          });
        }
        if (currentResponseStatus === 400) {
          return new Response("safety policy triggered", { status: 400 });
        }
        if (currentResponseStatus >= 500) {
          return new Response("Internal Server Error", { status: 500 });
        }

        return new Response(JSON.stringify(currentResponseBody), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    });
    mockServerUrl = `http://localhost:${mockServer.port}`;
  });

  afterAll(() => {
    mockServer.stop();
  });

  it("handles successful vision OCR extraction", async () => {
    currentResponseStatus = 200;
    currentResponseBody = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              language: "th",
              legibility: "good",
              blocks: [{ type: "heading", text: "บทนำ" }],
              warnings: [],
            }),
          },
        },
      ],
    };

    const provider = new NemotronExtractionProvider({
      baseUrl: mockServerUrl,
      apiKey: "test-api-key",
      model: "nemotron-test",
    });

    const res = await provider.extractPage(
      { image: new Uint8Array([1, 2, 3]), mime: "image/jpeg" },
      { signal: new AbortController().signal },
    );

    expect(res.language).toBe("th");
    expect(res.legibility).toBe("good");
    expect(res.blocks[0].text).toBe("บทนำ");
  });

  it("throws AI_CONTENT_BLOCKED when safety policy is triggered", async () => {
    currentResponseStatus = 400;

    const provider = new NemotronExtractionProvider({
      baseUrl: mockServerUrl,
      apiKey: "test-api-key",
      model: "nemotron-test",
    });

    try {
      await provider.extractPage(
        { image: new Uint8Array([1, 2, 3]), mime: "image/jpeg" },
        { signal: new AbortController().signal },
      );
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err).toBeInstanceOf(AppError);
      expect(err.code).toBe("AI_CONTENT_BLOCKED");
    }
  });

  it("throws AI_PROVIDER_UNAVAILABLE on persistent 429 after retries", async () => {
    currentResponseStatus = 429;

    const provider = new NemotronExtractionProvider({
      baseUrl: mockServerUrl,
      apiKey: "test-api-key",
      model: "nemotron-test",
    });

    try {
      await provider.extractPage(
        { image: new Uint8Array([1, 2, 3]), mime: "image/jpeg" },
        { signal: new AbortController().signal },
      );
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err).toBeInstanceOf(AppError);
      expect(err.code).toBe("AI_PROVIDER_UNAVAILABLE");
    }
  });

  it("throws AI_TIMEOUT on abort signal", async () => {
    currentResponseStatus = 200;

    const provider = new NemotronExtractionProvider({
      baseUrl: mockServerUrl,
      apiKey: "test-api-key",
      model: "nemotron-test",
    });

    const controller = new AbortController();
    controller.abort();

    try {
      await provider.extractPage(
        { image: new Uint8Array([1, 2, 3]), mime: "image/jpeg" },
        { signal: controller.signal },
      );
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err).toBeInstanceOf(AppError);
      expect(err.code).toBe("AI_TIMEOUT");
    }
  });
});
