import { readFileSync, readdirSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { extractText, getDocumentProxy } from "unpdf";
import { AppError } from "../lib/errors.ts";

export interface PdfPageText {
  pageNumber: number;
  text: string;
  isImageOnly: boolean;
}

export interface PdfExtractionResult {
  pages: PdfPageText[];
  totalPageCount: number;
  isAllImageOnly: boolean;
  isHybrid: boolean;
  hasTextLayer: boolean;
}

export async function parsePdfText(
  pdfBuffer: Uint8Array,
  maxPages = 100,
): Promise<PdfExtractionResult> {
  let doc: any;
  try {
    doc = await getDocumentProxy(pdfBuffer);
  } catch (err: any) {
    if (err.name === "PasswordException" || err.message?.includes("password")) {
      throw new AppError("PDF_ENCRYPTED", { message: "PDF is password protected" });
    }
    throw new AppError("FILE_CORRUPT", { message: "Failed to parse PDF document" });
  }

  const totalPageCount = doc.numPages;
  if (totalPageCount > maxPages) {
    throw new AppError("TOO_MANY_PAGES", {
      message: `PDF has ${totalPageCount} pages, exceeding limit of ${maxPages}`,
      details: { maxPages, totalPages: totalPageCount },
    });
  }

  const pages: PdfPageText[] = [];
  let imageOnlyCount = 0;

  for (let i = 1; i <= totalPageCount; i++) {
    const pageTextResult = await extractText(doc, { mergePages: false });
    const text =
      (Array.isArray(pageTextResult.text) ? pageTextResult.text[i - 1] : pageTextResult.text) || "";
    const cleanText = text.replace(/\s+/g, " ").trim();
    const isImageOnly = cleanText.length < 25;
    if (isImageOnly) {
      imageOnlyCount++;
    }

    pages.push({
      pageNumber: i,
      text: cleanText,
      isImageOnly,
    });
  }

  const isAllImageOnly = imageOnlyCount === totalPageCount;
  const isHybrid = imageOnlyCount > 0 && !isAllImageOnly;

  return {
    pages,
    totalPageCount,
    isAllImageOnly,
    isHybrid,
    hasTextLayer: imageOnlyCount < totalPageCount,
  };
}

export async function renderPdfPageToJpeg(
  pdfPath: string,
  pageNumber: number,
  outputDir: string,
  dpi = 150,
  timeoutMs = 30000,
): Promise<Uint8Array> {
  const prefix = `page-${pageNumber}`;
  const proc = Bun.spawn(
    [
      "pdftoppm",
      "-jpeg",
      "-r",
      dpi.toString(),
      "-f",
      pageNumber.toString(),
      "-l",
      pageNumber.toString(),
      pdfPath,
      join(outputDir, prefix),
    ],
    {
      stdout: "ignore",
      stderr: "pipe",
    },
  );

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => {
      proc.kill();
      reject(new AppError("AI_TIMEOUT", { message: `Rendering page ${pageNumber} timed out` }));
    }, timeoutMs),
  );

  await Promise.race([proc.exited, timeoutPromise]);

  const files = readdirSync(outputDir).filter(
    (f) => f.startsWith(prefix) && (f.endsWith(".jpg") || f.endsWith(".jpeg")),
  );

  if (files.length === 0) {
    throw new AppError("EXTRACTION_FAILED", {
      message: `pdftoppm failed to render page ${pageNumber}`,
    });
  }

  const renderedFile = join(outputDir, files[0]);
  const imageBytes = new Uint8Array(readFileSync(renderedFile));
  await rm(renderedFile, { force: true });
  return imageBytes;
}
