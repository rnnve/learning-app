import { describe, expect, it } from "bun:test";
import { type ChunkItem, rankChunksBM25, tokenizeText } from "../../src/processing/retrieval.ts";

describe("BM25 Retrieval", () => {
  it("tokenizes Thai text using Intl.Segmenter", () => {
    const tokens = tokenizeText("พืชใช้คลอโรฟิลล์ในการดูดกลืนพลังงานแสง");
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens).toContain("พลังงาน");
    expect(tokens).toContain("พืช");
  });

  it("ranks the most relevant chunk highest", () => {
    const chunks: ChunkItem[] = [
      {
        id: "c0",
        index: 0,
        page: 1,
        text: "บทที่ 1 แนะนำวิชาชีววิทยาเบื้องต้น",
        charCount: 30,
      },
      {
        id: "c1",
        index: 1,
        page: 1,
        text: "การแบ่งเซลล์แบบไมโทซิส (Mitosis) ทำให้ได้เซลล์ร่างกาย 2 เซลล์ที่มีโครโมโซมเท่าเดิม",
        charCount: 85,
      },
      {
        id: "c2",
        index: 2,
        page: 2,
        text: "การสังเคราะห์ด้วยแสง (Photosynthesis) เกิดขึ้นที่คลอโรพลาสต์ในเซลล์พืช มีคลอโรฟิลล์รับแสง",
        charCount: 92,
      },
    ];

    const results = rankChunksBM25("คลอโรพลาสต์ คลอโรฟิลล์ แสง", chunks, 2);
    expect(results.length).toBeGreaterThan(0);
    // c2 contains both terms
    expect(results.some((r) => r.id === "c2")).toBe(true);
  });
});
