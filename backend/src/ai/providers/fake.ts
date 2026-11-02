import type { TSchema } from "@sinclair/typebox";
import type { ChatOutput } from "../schemas/chat.ts";
import type { ExtractionOutput } from "../schemas/extraction.ts";
import type { FlashcardsContent } from "../schemas/flashcards.ts";
import type { GradingOutput } from "../schemas/grading.ts";
import type { QuizContent } from "../schemas/quiz.ts";
import type { SummaryContent } from "../schemas/summary.ts";
import type { ExtractionProvider, GenerationProvider } from "./types.ts";

export class FakeExtractionProvider implements ExtractionProvider {
  public async extractPage(
    input: {
      image: Uint8Array;
      mime: string;
      pageHint?: number;
      languageHint?: "th" | "en";
    },
    _opts: { signal: AbortSignal },
  ): Promise<ExtractionOutput> {
    const page = input.pageHint ?? 1;
    return {
      language: "th",
      legibility: "good",
      blocks: [
        {
          type: "heading",
          text: `[ตัวอย่างจำลอง / FIXTURE] หัวข้อหน้า ${page}`,
        },
        {
          type: "paragraph",
          text: `[ตัวอย่างจำลอง / FIXTURE] เนื้อหาจำลองสำหรับการทดสอบระบบ หน้าที่ ${page} ข้อความนี้สร้างขึ้นโดย FakeProvider เพื่อทดสอบโฟลว์การทำงาน`,
        },
      ],
      warnings: [],
    };
  }
}

export class FakeGenerationProvider implements GenerationProvider {
  public async generateJson<T = unknown>(
    req: {
      system: string;
      user: string;
      schema: TSchema;
      schemaName: string;
      temperature?: number;
      maxOutputTokens?: number;
    },
    _opts: { signal: AbortSignal },
  ): Promise<{ data: T; raw: string; usage?: Record<string, any> }> {
    let fixtureData: any;

    if (req.schemaName.toLowerCase().includes("summary")) {
      const summary: SummaryContent = {
        overview: "[ตัวอย่างจำลอง / FIXTURE] ภาพรวมสรุปเนื้อหาสำหรับการทดสอบระบบ",
        keyPoints: [
          {
            text: "[ตัวอย่างจำลอง / FIXTURE] ประเด็นสำคัญข้อที่หนึ่ง",
            sourceRefs: [{ chunkId: "c0", page: 1, quote: null }],
          },
          {
            text: "[ตัวอย่างจำลอง / FIXTURE] ประเด็นสำคัญข้อที่สอง",
            sourceRefs: [{ chunkId: "c0", page: 1, quote: null }],
          },
        ],
        sections: [
          {
            heading: "[ตัวอย่างจำลอง / FIXTURE] หมวดหมู่หลัก",
            body: "[ตัวอย่างจำลอง / FIXTURE] รายละเอียดส่วนเนื้อหาจำลองเพื่อการตรวจสอบระบบ",
            sourceRefs: [{ chunkId: "c0", page: 1, quote: null }],
          },
        ],
        glossary: [
          {
            term: "คำศัพท์จำลอง",
            definition: "[ตัวอย่างจำลอง / FIXTURE] ความหมายของคำศัพท์สำหรับทดสอบ",
          },
        ],
        limitations: ["[ตัวอย่างจำลอง / FIXTURE] ข้อจำกัดเพื่อการทดสอบ"],
      };
      fixtureData = summary;
    } else if (req.schemaName.toLowerCase().includes("flashcard")) {
      const flashcards: FlashcardsContent = {
        cards: [
          {
            id: "card-1",
            front: "[ตัวอย่างจำลอง / FIXTURE] คำถามแฟลชการ์ดข้อ 1?",
            back: "[ตัวอย่างจำลอง / FIXTURE] คำตอบแฟลชการ์ดข้อ 1",
            hint: "คำใบ้จำลอง",
            tags: ["ทดสอบ"],
            sourceRefs: [{ chunkId: "c0", page: 1, quote: null }],
          },
          {
            id: "card-2",
            front: "[ตัวอย่างจำลอง / FIXTURE] คำถามแฟลชการ์ดข้อ 2?",
            back: "[ตัวอย่างจำลอง / FIXTURE] คำตอบแฟลชการ์ดข้อ 2",
            hint: null,
            tags: ["ทดสอบ"],
            sourceRefs: [{ chunkId: "c0", page: 1, quote: null }],
          },
        ],
      };
      fixtureData = flashcards;
    } else if (req.schemaName.toLowerCase().includes("quiz")) {
      const quiz: QuizContent = {
        questions: [
          {
            id: "q-1",
            type: "multiple_choice",
            prompt: "[ตัวอย่างจำลอง / FIXTURE] คำถามแบบเลือกตอบข้อที่ 1?",
            choices: [
              { id: "a", text: "[ตัวอย่างจำลอง / FIXTURE] ตัวเลือก ก (ถูกต้อง)" },
              { id: "b", text: "[ตัวอย่างจำลอง / FIXTURE] ตัวเลือก ข" },
              { id: "c", text: "[ตัวอย่างจำลอง / FIXTURE] ตัวเลือก ค" },
              { id: "d", text: "[ตัวอย่างจำลอง / FIXTURE] ตัวเลือก ง" },
            ],
            correctChoiceId: "a",
            acceptedAnswers: null,
            modelAnswer: null,
            explanation: "[ตัวอย่างจำลอง / FIXTURE] คำอธิบายเหตุผลของข้อ 1",
            difficulty: "easy",
            sourceRefs: [{ chunkId: "c0", page: 1, quote: null }],
          },
          {
            id: "q-2",
            type: "true_false",
            prompt: "[ตัวอย่างจำลอง / FIXTURE] ข้อความนี้ถูกต้องหรือไม่?",
            choices: [
              { id: "true", text: "จริง" },
              { id: "false", text: "เท็จ" },
            ],
            correctChoiceId: "true",
            acceptedAnswers: null,
            modelAnswer: null,
            explanation: "[ตัวอย่างจำลอง / FIXTURE] คำอธิบายเหตุผล",
            difficulty: "easy",
            sourceRefs: [{ chunkId: "c0", page: 1, quote: null }],
          },
        ],
      };
      fixtureData = quiz;
    } else if (req.schemaName.toLowerCase().includes("chat")) {
      const chat: ChatOutput = {
        answer: "[ตัวอย่างจำลอง / FIXTURE] น้องติวยินดีช่วยเหลือครับ นี่คือคำตอบจำลองเพื่อการทดสอบ",
        grounding: "source",
        usedChunkIds: ["c0"],
        suggestedFollowUps: ["[ตัวอย่างจำลอง / FIXTURE] ต้องการให้สรุปเพิ่มเติมไหมครับ?"],
      };
      fixtureData = chat;
    } else if (req.schemaName.toLowerCase().includes("grading")) {
      const grading: GradingOutput = {
        verdict: "correct",
        feedback: "[ตัวอย่างจำลอง / FIXTURE] ยอดเยี่ยมมากครับ ตอบได้ถูกต้องและครอบคลุมความหมายสำคัญ",
      };
      fixtureData = grading;
    } else {
      fixtureData = { message: "[ตัวอย่างจำลอง / FIXTURE]" };
    }

    return {
      data: fixtureData as T,
      raw: JSON.stringify(fixtureData),
      usage: { promptTokens: 10, completionTokens: 10 },
    };
  }
}
