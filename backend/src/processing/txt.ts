export function decodeText(buffer: Uint8Array): { text: string; encoding: string } {
  // 1. UTF-16 LE BOM (FF FE) or BE BOM (FE FF)
  if (buffer.length >= 2) {
    if (buffer[0] === 0xff && buffer[1] === 0xfe) {
      return { text: new TextDecoder("utf-16le").decode(buffer.subarray(2)), encoding: "utf-16le" };
    }
    if (buffer[0] === 0xfe && buffer[1] === 0xff) {
      return { text: new TextDecoder("utf-16be").decode(buffer.subarray(2)), encoding: "utf-16be" };
    }
  }

  // 2. UTF-8 BOM (EF BB BF)
  let bytes = buffer;
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    bytes = buffer.subarray(3);
  }

  // 3. Try UTF-8 first
  const utf8Text = new TextDecoder("utf-8").decode(bytes);
  const replacementCount = (utf8Text.match(/\uFFFD/g) || []).length;

  // If there are replacement characters, check if Windows-874 decodes cleaner
  if (replacementCount > 0) {
    try {
      const win874Text = new TextDecoder("windows-874").decode(bytes);
      const win874Replacements = (win874Text.match(/\uFFFD/g) || []).length;
      if (win874Replacements < replacementCount) {
        return { text: normalizeNewlines(win874Text), encoding: "windows-874" };
      }
    } catch {
      // Fallback to utf-8 result if windows-874 decoder not supported
    }
  }

  return { text: normalizeNewlines(utf8Text), encoding: "utf-8" };
}

export function normalizeNewlines(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
