import { describe, expect, it } from "bun:test";
import { detectLanguage } from "../../src/processing/language.ts";

describe("Language Detector", () => {
  it("detects Thai text", () => {
    const thaiText = "การสังเคราะห์ด้วยแสงเป็นกระบวนการทางชีวเคมีที่สำคัญยิ่งในการสร้างอาหารของพืชสีเขียว";
    expect(detectLanguage(thaiText)).toBe("th");
  });

  it("detects English text", () => {
    const englishText =
      "Photosynthesis is the process used by plants and other organisms to convert light energy into chemical energy.";
    expect(detectLanguage(englishText)).toBe("en");
  });

  it("detects mixed text", () => {
    const mixedText = "Chapter 1: Cellular Respiration and Biochemistry บทเรียนเรื่องการหายใจระดับเซลล์";
    expect(detectLanguage(mixedText)).toBe("mixed");
  });

  it("returns unknown for too little text", () => {
    expect(detectLanguage("hi")).toBe("unknown");
    expect(detectLanguage("")).toBe("unknown");
  });
});
