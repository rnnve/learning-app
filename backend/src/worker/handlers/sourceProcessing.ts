import { eq } from "drizzle-orm";
import { getExtractionProvider } from "../../ai/providers/factory.ts";
import { env } from "../../config/env.ts";
import { getDb, schema } from "../../db/client.ts";
import { AppError } from "../../lib/errors.ts";
import { type RawPageText, chunkPages } from "../../processing/chunker.ts";
import { extractDocxText } from "../../processing/docx.ts";
import { normalizeImage } from "../../processing/images.ts";
import { detectLanguage } from "../../processing/language.ts";
import { parsePdfText, renderPdfPageToJpeg } from "../../processing/pdf.ts";
import { runInSandbox } from "../../processing/sandbox.ts";
import { decodeText } from "../../processing/txt.ts";
import { storage } from "../../storage/local.ts";

export interface SourceProcessingJobPayload {
  sourceId: string;
  userId: string;
}

export async function processSourceJob(
  jobId: string,
  payload: SourceProcessingJobPayload,
  updateProgress: (stage: string, progress: number, detail?: any) => Promise<void>,
  signal: AbortSignal,
): Promise<{ sourceId: string }> {
  const db = getDb();
  const { sourceId, userId } = payload;

  const [source] = await db.select().from(schema.sources).where(eq(schema.sources.id, sourceId));
  if (!source) {
    throw new AppError("NOT_FOUND", { message: "Source not found" });
  }

  await db
    .update(schema.sources)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(schema.sources.id, sourceId));

  const files = await db
    .select()
    .from(schema.sourceFiles)
    .where(eq(schema.sourceFiles.sourceId, sourceId))
    .orderBy(schema.sourceFiles.idx);

  if (files.length === 0) {
    throw new AppError("FILE_CORRUPT", { message: "Source has no files associated" });
  }

  await updateProgress("validating", 10);

  const rawPages: RawPageText[] = [];
  const warnings: { code: string; message: string; page: number | null }[] = [];
  let extractionMethod: "direct_text" | "vision_ocr" | "hybrid" = "direct_text";
  let overallQuality: "good" | "fair" | "poor" | "unreadable" = "good";
  const pagesFailed: number[] = [];

  if (source.kind === "images") {
    extractionMethod = "vision_ocr";
    await updateProgress("normalizing_images", 20);

    const extractionProvider = getExtractionProvider();
    const totalImages = files.length;

    for (let i = 0; i < totalImages; i++) {
      if (signal.aborted) throw new AppError("AI_TIMEOUT", { message: "Job aborted" });

      const fileRecord = files[i];
      const rawBytes = await storage.getFile(fileRecord.storageKey);

      // Normalize with sharp
      const normalized = await normalizeImage(rawBytes);
      await storage.saveFile(fileRecord.storageKey, normalized.buffer);

      const pageNum = i + 1;
      const progressPct = Math.round(20 + (60 * pageNum) / totalImages);
      await updateProgress("ocr", progressPct, { page: pageNum, pagesTotal: totalImages });

      try {
        const ocrResult = await extractionProvider.extractPage(
          {
            image: normalized.buffer,
            mime: "image/jpeg",
            pageHint: pageNum,
            languageHint:
              source.language === "th" || source.language === "en"
                ? (source.language as any)
                : undefined,
          },
          { signal },
        );

        const pageText = ocrResult.blocks
          .map((b) => {
            if (b.type === "diagram") return `[แผนภาพ: ${b.text}]`;
            return b.text;
          })
          .join("\n\n");

        if (ocrResult.legibility === "poor") overallQuality = "poor";
        if (ocrResult.legibility === "unreadable") {
          overallQuality = "unreadable";
          pagesFailed.push(pageNum);
          warnings.push({
            code: "PAGE_UNREADABLE",
            message: `หน้าที่ ${pageNum} ตัวหนังสือไม่ชัดเจนหรือไม่สามารถอ่านได้`,
            page: pageNum,
          });
        }

        rawPages.push({ page: pageNum, text: pageText });
      } catch (ocrErr: any) {
        pagesFailed.push(pageNum);
        warnings.push({
          code: "EXTRACTION_PAGE_FAILED",
          message: `การสกัดข้อความหน้าที่ ${pageNum} ล้มเหลว`,
          page: pageNum,
        });
      }
    }
  } else if (source.kind === "txt") {
    extractionMethod = "direct_text";
    await updateProgress("extracting_text", 40);

    const fileBytes = await storage.getFile(files[0].storageKey);
    const decoded = decodeText(fileBytes);
    rawPages.push({ page: 1, text: decoded.text });
  } else if (source.kind === "docx") {
    extractionMethod = "direct_text";
    await updateProgress("extracting_text", 40);

    const fileBytes = await storage.getFile(files[0].storageKey);
    const docxResult = await runInSandbox(jobId, 60000, async () => {
      return await extractDocxText(fileBytes);
    });

    if (docxResult.warnings) {
      warnings.push(...docxResult.warnings);
    }
    rawPages.push({ page: 1, text: docxResult.text });
  } else if (source.kind === "pdf") {
    await updateProgress("extracting_text", 30);

    const fileBytes = await storage.getFile(files[0].storageKey);
    const pdfResult = await runInSandbox(jobId, 60000, async () => {
      return await parsePdfText(fileBytes, env.MAX_PDF_PAGES);
    });

    if (pdfResult.isAllImageOnly) {
      extractionMethod = "vision_ocr";
    } else if (pdfResult.isHybrid) {
      extractionMethod = "hybrid";
    } else {
      extractionMethod = "direct_text";
    }

    if (extractionMethod === "direct_text") {
      warnings.push({
        code: "EMBEDDED_IMAGES_NOT_ANALYZED",
        message: "รูปภาพที่ฝังอยู่ในเอกสาร PDF ไม่ได้ถูกนำมาวิเคราะห์",
        page: null,
      });
      for (const p of pdfResult.pages) {
        rawPages.push({ page: p.pageNumber, text: p.text });
      }
    } else {
      // Vision OCR or Hybrid route
      const extractionProvider = getExtractionProvider();
      const ocrCap = Math.min(pdfResult.totalPageCount, env.OCR_PAGE_CAP);

      await runInSandbox(jobId, 180000, async (tempDir) => {
        const filePath = storage.getFilePath(files[0].storageKey);

        for (let pNum = 1; pNum <= ocrCap; pNum++) {
          if (signal.aborted) throw new AppError("AI_TIMEOUT", { message: "Job aborted" });

          const progressPct = Math.round(30 + (50 * pNum) / ocrCap);
          await updateProgress("ocr", progressPct, {
            page: pNum,
            pagesTotal: pdfResult.totalPageCount,
          });

          const pdfPage = pdfResult.pages[pNum - 1];
          if (!pdfPage.isImageOnly && extractionMethod === "hybrid") {
            rawPages.push({ page: pNum, text: pdfPage.text });
            continue;
          }

          try {
            const pageImageBytes = await renderPdfPageToJpeg(filePath, pNum, tempDir);
            const ocrRes = await extractionProvider.extractPage(
              { image: pageImageBytes, mime: "image/jpeg", pageHint: pNum },
              { signal },
            );

            const pageText = ocrRes.blocks.map((b) => b.text).join("\n\n");
            rawPages.push({ page: pNum, text: pageText });
          } catch (err: any) {
            pagesFailed.push(pNum);
            warnings.push({
              code: "EXTRACTION_PAGE_FAILED",
              message: `การสกัดข้อความหน้าที่ ${pNum} ล้มเหลว`,
              page: pNum,
            });
          }
        }

        if (pdfResult.totalPageCount > env.OCR_PAGE_CAP) {
          warnings.push({
            code: "OCR_PAGE_CAP",
            message: `ระบบวิเคราะห์หน้าเอกสารถึงหน้าที่ ${env.OCR_PAGE_CAP} หน้าถัดไปถูกข้าม`,
            page: env.OCR_PAGE_CAP + 1,
          });
        }
      });
    }
  }

  // Post extraction checks
  await updateProgress("chunking", 85);

  const fullText = rawPages
    .map((p) => p.text)
    .join("\n\n")
    .trim();
  const totalChars = fullText.length;

  if (totalChars < 20) {
    if (source.kind === "images" && overallQuality === "unreadable") {
      throw new AppError("IMAGE_UNREADABLE", {
        message: "ภาพไม่ชัดเจนหรือไม่สามารถอ่านข้อความได้",
      });
    }
    throw new AppError("NO_EXTRACTABLE_CONTENT", {
      message: "ไม่พบข้อความที่สามารถนำมาใช้งานได้",
    });
  }

  const detectedLanguage = detectLanguage(fullText);
  const chunks = chunkPages(rawPages, env.CHUNK_TARGET_CHARS, env.CHUNK_OVERLAP_CHARS);

  await updateProgress("finalizing", 95);

  // Determine final status
  let finalStatus: "ready" | "partial" | "failed" = "ready";
  if (pagesFailed.length > 0 || warnings.length > 0 || overallQuality === "poor") {
    finalStatus = "partial";
  }

  // Persist chunks and update source in transaction
  await db.transaction(async (tx) => {
    // Delete existing chunks if retried
    await tx.delete(schema.sourceChunks).where(eq(schema.sourceChunks.sourceId, sourceId));

    if (chunks.length > 0) {
      await tx.insert(schema.sourceChunks).values(
        chunks.map((c) => ({
          sourceId,
          idx: c.idx,
          page: c.page,
          text: c.text,
          charCount: c.charCount,
        })),
      );
    }

    await tx
      .update(schema.sources)
      .set({
        status: finalStatus,
        language: detectedLanguage,
        charCount: totalChars,
        pageCount: rawPages.length || 1,
        extraction: {
          method: extractionMethod,
          quality: overallQuality,
          pagesTotal: rawPages.length || 1,
          pagesExtracted: rawPages.length - pagesFailed.length,
          pagesFailed,
          warnings,
        },
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.sources.id, sourceId));
  });

  return { sourceId };
}
