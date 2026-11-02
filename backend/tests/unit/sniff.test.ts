import { describe, expect, it } from "bun:test";
import { sniffBytes } from "../../src/processing/sniff.ts";

describe("Magic Byte Sniffer", () => {
  it("detects JPEG magic bytes", () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const res = sniffBytes(bytes);
    expect(res.kind).toBe("jpeg");
    expect(res.sourceKind).toBe("images");
    expect(res.mime).toBe("image/jpeg");
  });

  it("detects PNG magic bytes", () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const res = sniffBytes(bytes);
    expect(res.kind).toBe("png");
    expect(res.sourceKind).toBe("images");
  });

  it("detects WebP magic bytes", () => {
    // RIFF....WEBP
    const bytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    const res = sniffBytes(bytes);
    expect(res.kind).toBe("webp");
    expect(res.sourceKind).toBe("images");
  });

  it("detects PDF magic bytes", () => {
    const bytes = new TextEncoder().encode("%PDF-1.7 sample document");
    const res = sniffBytes(bytes);
    expect(res.kind).toBe("pdf");
    expect(res.sourceKind).toBe("pdf");
  });

  it("detects TXT with plain text and rejects binary with NUL", () => {
    const textBytes = new TextEncoder().encode("สวัสดีครับ นี่คือข้อความภาษาไทย");
    const res = sniffBytes(textBytes);
    expect(res.kind).toBe("txt");
    expect(res.sourceKind).toBe("txt");

    const binaryBytes = new Uint8Array([0x12, 0x00, 0x45, 0x67]);
    const binRes = sniffBytes(binaryBytes);
    expect(binRes.kind).toBe("unknown");
    expect(binRes.sourceKind).toBe("unsupported");
  });
});
