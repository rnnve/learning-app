import { describe, expect, it } from "bun:test";
import { NemoRetrieverOcrProvider, parseOcrResponse } from "../../src/ai/providers/nemo-ocr.ts";

describe("NeMo Retriever OCR", () => {
  it("converts text detections into language and legibility with preserved order", () => {
    const result = parseOcrResponse({
      data: [
        {
          text_detections: [
            { text_prediction: { text: "บทนำ", confidence: 0.99 } },
            { text_prediction: { text: "การสังเคราะห์ด้วยแสงของพืช", confidence: 0.95 } },
          ],
        },
      ],
    });
    expect(result.language).toBe("th");
    expect(result.legibility).toBe("good");
    expect(result.blocks.map((block) => block.text)).toEqual(["บทนำ", "การสังเคราะห์ด้วยแสงของพืช"]);
  });

  it("distinguishes empty detections from malformed responses", () => {
    expect(parseOcrResponse({ data: [{ text_detections: [] }] }).legibility).toBe("unreadable");
    expect(() => parseOcrResponse({ choices: [] })).toThrow();
    expect(() =>
      parseOcrResponse({ data: [{ text_detections: [{ text_prediction: {} }] }] }),
    ).toThrow();
  });

  it("sends the dedicated OCR protocol and honors cancellation", async () => {
    let requestBody: any;
    let requestPath: string | undefined;
    const server = Bun.serve({
      port: 0,
      async fetch(request) {
        requestPath = new URL(request.url).pathname;
        requestBody = await request.json();
        return Response.json({
          data: [
            {
              text_detections: [
                { text_prediction: { text: "Plants use sunlight.", confidence: 0.98 } },
              ],
            },
          ],
        });
      },
    });
    try {
      const provider = new NemoRetrieverOcrProvider({
        baseUrl: `http://localhost:${server.port}/ocr`,
        apiKey: "test-key",
      });
      const input = { image: new Uint8Array([1, 2, 3]), mime: "image/png" };
      const result = await provider.extractPage(input, { signal: new AbortController().signal });
      expect(requestPath).toBe("/ocr");
      expect(requestBody).toEqual({
        input: [{ type: "image_url", url: "data:image/png;base64,AQID" }],
        merge_levels: ["paragraph"],
      });
      expect(result.blocks[0].text).toBe("Plants use sunlight.");
      await expect(
        provider.extractPage(input, { signal: AbortSignal.abort() }),
      ).rejects.toMatchObject({ code: "AI_TIMEOUT" });
    } finally {
      server.stop();
    }
  });
});
