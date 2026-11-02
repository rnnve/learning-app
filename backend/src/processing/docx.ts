import mammoth from "mammoth";
import { AppError } from "../lib/errors.ts";
import { normalizeNewlines } from "./txt.ts";

export interface DocxExtractionResult {
  text: string;
  hasEmbeddedImages: boolean;
  warnings: { code: string; message: string; page: number | null }[];
}

export async function extractDocxText(docxBuffer: Uint8Array): Promise<DocxExtractionResult> {
  const warnings: { code: string; message: string; page: number | null }[] = [];

  // Check if buffer contains embedded images (word/media/)
  const headerSlice = docxBuffer.subarray(0, Math.min(docxBuffer.length, 100000));
  const rawStr = new TextDecoder("latin1").decode(headerSlice);
  const hasEmbeddedImages = rawStr.includes("word/media/") || docxBuffer.length > 500000;

  if (hasEmbeddedImages) {
    warnings.push({
      code: "EMBEDDED_IMAGES_NOT_ANALYZED",
      message: "รูปภาพที่ฝังอยู่ในเอกสาร DOCX จะไม่ถูกนำมาวิเคราะห์",
      page: null,
    });
  }

  try {
    const result = await mammoth.extractRawText({
      buffer: Buffer.from(docxBuffer),
    });

    const cleanText = normalizeNewlines(result.value || "");
    return {
      text: cleanText,
      hasEmbeddedImages,
      warnings,
    };
  } catch (err: any) {
    throw new AppError("FILE_CORRUPT", {
      message: `Failed to parse DOCX document: ${err.message}`,
    });
  }
}
