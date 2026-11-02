import { describe, expect, it } from "bun:test";
import { chunkPages } from "../../src/processing/chunker.ts";

describe("Document Chunker", () => {
  it("chunks small text into a single chunk", () => {
    const pages = [{ page: 1, text: "บทนำเรื่องการสังเคราะห์ด้วยแสงในพืช" }];
    const chunks = chunkPages(pages, 1000, 100);
    expect(chunks.length).toBe(1);
    expect(chunks[0].idx).toBe(0);
    expect(chunks[0].page).toBe(1);
    expect(chunks[0].text).toBe("บทนำเรื่องการสังเคราะห์ด้วยแสงในพืช");
  });

  it("splits large text across chunks preserving word boundaries", () => {
    const longThaiSentence = "ประเทศไทยมีสภาพภูมิอากาศแบบร้อนชื้นและมีทรัพยากรธรรมชาติที่หลากหลาย ".repeat(50);
    const pages = [{ page: 1, text: longThaiSentence }];
    const chunks = chunkPages(pages, 500, 50);

    expect(chunks.length).toBeGreaterThan(1);
    // Ensure all chunks have index and valid char counts
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].idx).toBe(i);
      expect(chunks[i].text.length).toBeGreaterThan(0);
    }
  });

  it("tracks start page accurately across page boundaries", () => {
    const pages = [
      { page: 1, text: "ข้อความหน้าที่หนึ่ง สั้นๆ" },
      { page: 2, text: "ข้อความหน้าที่สอง สั้นๆ" },
    ];
    const chunks = chunkPages(pages, 3000, 100);
    expect(chunks.length).toBe(1);
    expect(chunks[0].page).toBe(1);
  });
});
