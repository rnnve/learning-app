import { describe, expect, it } from "bun:test";
import { decodeText, normalizeNewlines } from "../../src/processing/txt.ts";

describe("TXT Decoder", () => {
  it("decodes standard UTF-8 text", () => {
    const raw = "สวัสดีชาวโลก\r\nบรรทัดที่สอง";
    const bytes = new TextEncoder().encode(raw);
    const decoded = decodeText(bytes);
    expect(decoded.encoding).toBe("utf-8");
    expect(decoded.text).toBe("สวัสดีชาวโลก\nบรรทัดที่สอง");
  });

  it("handles UTF-8 with BOM", () => {
    const raw = "สวัสดี";
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(raw)]);
    const decoded = decodeText(bytes);
    expect(decoded.text).toBe("สวัสดี");
  });

  it("handles UTF-16LE with BOM", () => {
    const raw = "Hello";
    const utf16le = new Uint8Array([
      0xff, 0xfe, 0x48, 0x00, 0x65, 0x00, 0x6c, 0x00, 0x6c, 0x00, 0x6f, 0x00,
    ]);
    const decoded = decodeText(utf16le);
    expect(decoded.encoding).toBe("utf-16le");
    expect(decoded.text).toBe("Hello");
  });

  it("normalizes newlines correctly", () => {
    const mixed = "Line 1\r\n\r\n\r\n\r\nLine 2\rLine 3";
    const normalized = normalizeNewlines(mixed);
    expect(normalized).toBe("Line 1\n\nLine 2\nLine 3");
  });
});
