export type SniffedKind = "jpeg" | "png" | "webp" | "pdf" | "docx" | "txt" | "unknown";

export interface SniffResult {
  kind: SniffedKind;
  mime: string;
  sourceKind: "images" | "pdf" | "docx" | "txt" | "unsupported";
}

export function sniffBytes(buffer: Uint8Array): SniffResult {
  if (!buffer || buffer.length === 0) {
    return { kind: "unknown", mime: "application/octet-stream", sourceKind: "unsupported" };
  }

  // 1. JPEG: FF D8 FF
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { kind: "jpeg", mime: "image/jpeg", sourceKind: "images" };
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { kind: "png", mime: "image/png", sourceKind: "images" };
  }

  // 3. WebP: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50 // P
  ) {
    return { kind: "webp", mime: "image/webp", sourceKind: "images" };
  }

  // 4. PDF: %PDF- (25 50 44 46 2D)
  if (
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    return { kind: "pdf", mime: "application/pdf", sourceKind: "pdf" };
  }

  // 5. DOCX: ZIP magic PK\x03\x04
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  ) {
    // Check if it looks like an OpenXML document (has word/ or [Content_Types].xml in raw bytes)
    const headerSlice = buffer.subarray(0, Math.min(buffer.length, 4096));
    const headerStr = new TextDecoder("latin1").decode(headerSlice);
    if (headerStr.includes("[Content_Types].xml") || headerStr.includes("word/")) {
      return {
        kind: "docx",
        mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        sourceKind: "docx",
      };
    }
  }

  // 6. TXT: Check for no NUL bytes and valid UTF-8/legacy text
  let hasNull = false;
  const checkLen = Math.min(buffer.length, 8192);
  for (let i = 0; i < checkLen; i++) {
    if (buffer[i] === 0x00) {
      hasNull = true;
      break;
    }
  }

  if (!hasNull) {
    return { kind: "txt", mime: "text/plain", sourceKind: "txt" };
  }

  return { kind: "unknown", mime: "application/octet-stream", sourceKind: "unsupported" };
}
