import { describe, expect, it } from "bun:test";
import {
  postprocessFlashcards,
  postprocessQuiz,
  postprocessSummary,
  resolveSourceRefs,
} from "../../src/ai/pipeline/postprocess.ts";
import type { ChunkItem } from "../../src/processing/retrieval.ts";

describe("Post-Processing & Validation", () => {
  const chunksMap = new Map<string, ChunkItem>([
    [
      "c0",
      {
        id: "c0",
        index: 0,
        page: 1,
        text: "การสังเคราะห์ด้วยแสงเกิดขึ้นในคลอโรพลาสต์ของพืช",
        charCount: 46,
      },
    ],
  ]);

  it("verifies verbatim quote and keeps only exact substrings <= 200 chars", () => {
    const refs = [
      {
        chunkId: "c0",
        page: null,
        quote: "เกิดขึ้นในคลอโรพลาสต์", // exact match
      },
      {
        chunkId: "c0",
        page: null,
        quote: "ข้อความที่ไม่ได้มีอยู่ในเอกสารเลย", // fabricated
      },
      {
        chunkId: "c999", // non-existent chunk
        page: null,
        quote: null,
      },
    ];

    const resolved = resolveSourceRefs(refs, chunksMap);
    expect(resolved.length).toBe(2); // c999 dropped
    expect(resolved[0].page).toBe(1); // page filled from chunk
    expect(resolved[0].quote).toBe("เกิดขึ้นในคลอโรพลาสต์");
    expect(resolved[1].quote).toBeNull(); // fabricated quote set to null
  });

  it("postprocesses summary content correctly", () => {
    const raw = {
      overview: "ภาพรวมของบทเรียน",
      keyPoints: [
        { text: "ประเด็นหลัก 1", sourceRefs: [{ chunkId: "c0", page: null, quote: null }] },
      ],
      sections: [{ heading: "หัวข้อ 1", body: "เนื้อหา 1", sourceRefs: [] }],
      glossary: [{ term: "คลอโรพลาสต์", definition: "ออร์แกเนลล์" }],
      limitations: [],
    };

    const processed = postprocessSummary(raw, chunksMap);
    expect(processed.overview).toBe("ภาพรวมของบทเรียน");
    expect(processed.keyPoints[0].sourceRefs[0].page).toBe(1);
  });

  it("postprocesses and deduplicates flashcards", () => {
    const raw = {
      cards: [
        { id: "x", front: "แสงสำคัญไหม?", back: "สำคัญมาก", hint: null, tags: [], sourceRefs: [] },
        { id: "y", front: "แสงสำคัญไหม?", back: "ซ้ำซ้อน", hint: null, tags: [], sourceRefs: [] },
      ],
    };

    const processed = postprocessFlashcards(raw, chunksMap, 5);
    expect(processed.cards.length).toBe(1);
    expect(processed.cards[0].id).toBe("card-1");
  });

  it("enforces quiz integrity and choice distribution", () => {
    const raw = {
      questions: [
        {
          id: "q1",
          type: "multiple_choice" as const,
          prompt: "ข้อใดถูกต้อง?",
          choices: [
            { id: "a", text: "ตัวเลือก A" },
            { id: "b", text: "ตัวเลือก B" },
            { id: "c", text: "ตัวเลือก C" },
          ],
          correctChoiceId: "a",
          acceptedAnswers: null,
          modelAnswer: null,
          explanation: "เหตุผล",
          difficulty: "easy" as const,
          sourceRefs: [],
        },
      ],
    };

    const processed = postprocessQuiz(raw, chunksMap, 1);
    expect(processed.questions.length).toBe(1);
    expect(processed.questions[0].id).toBe("q-1");
  });
});
