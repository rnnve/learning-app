import { and, asc, desc, eq, gt, ilike, lt, sql } from "drizzle-orm";
import { env } from "../config/env.ts";
import { getDb, schema } from "../db/client.ts";
import { AppError } from "../lib/errors.ts";
import { decodeFilename } from "../lib/filename.ts";
import { sha256 } from "../lib/hash.ts";
import { generateId } from "../lib/ids.ts";
import { sniffBytes } from "../processing/sniff.ts";
import { storage } from "../storage/local.ts";

export interface CreateSourceFileInput {
  filename: string;
  bytes: Uint8Array;
  mime: string;
}

export class SourceService {
  public async createSource(params: {
    userId: string;
    files: CreateSourceFileInput[];
    title?: string;
    language?: "th" | "en";
  }) {
    const { userId, files: uploadedFiles, title, language } = params;
    const files = uploadedFiles?.map((file) => ({
      ...file,
      filename: decodeFilename(file.filename),
    }));

    if (!files || files.length === 0) {
      throw new AppError("VALIDATION_ERROR", { message: "At least one file must be uploaded" });
    }

    // 1. Sniff all files
    const sniffed = files.map((f) => {
      const result = sniffBytes(f.bytes);
      return { file: f, sniff: result };
    });

    const isAllImages = sniffed.every((s) => s.sniff.sourceKind === "images");
    const hasDocuments = sniffed.some(
      (s) =>
        s.sniff.sourceKind === "pdf" ||
        s.sniff.sourceKind === "docx" ||
        s.sniff.sourceKind === "txt",
    );

    if (isAllImages && hasDocuments) {
      throw new AppError("VALIDATION_ERROR", {
        message: "Cannot mix image files with document files in a single source",
      });
    }

    let sourceKind: "images" | "txt" | "pdf" | "docx";

    if (isAllImages) {
      sourceKind = "images";
      if (files.length > env.MAX_IMAGES_PER_SOURCE) {
        throw new AppError("TOO_MANY_FILES", {
          message: `Too many images uploaded (max ${env.MAX_IMAGES_PER_SOURCE})`,
          details: { maxFiles: env.MAX_IMAGES_PER_SOURCE },
        });
      }
      for (const item of sniffed) {
        if (item.file.bytes.length > env.MAX_IMAGE_BYTES) {
          throw new AppError("FILE_TOO_LARGE", {
            message: `Image ${item.file.filename} exceeds maximum size of ${env.MAX_IMAGE_BYTES} bytes`,
            details: { maxBytes: env.MAX_IMAGE_BYTES },
          });
        }
      }
    } else {
      if (files.length !== 1) {
        throw new AppError("VALIDATION_ERROR", {
          message: "Documents must be uploaded one file at a time",
        });
      }
      const doc = sniffed[0];
      if (doc.sniff.sourceKind === "unsupported") {
        throw new AppError("UNSUPPORTED_MEDIA_TYPE", {
          message: "Unsupported file type or content does not match extension",
        });
      }
      sourceKind = doc.sniff.sourceKind as "txt" | "pdf" | "docx";

      if (doc.file.bytes.length > env.MAX_DOCUMENT_BYTES) {
        throw new AppError("FILE_TOO_LARGE", {
          message: `Document exceeds maximum size of ${env.MAX_DOCUMENT_BYTES} bytes`,
          details: { maxBytes: env.MAX_DOCUMENT_BYTES },
        });
      }
    }

    const sourceId = generateId();
    const jobId = generateId();
    const db = getDb();

    // Compute total size and combined content hash
    let totalSize = 0;
    const combinedBytes: number[] = [];
    for (const f of files) {
      totalSize += f.bytes.length;
      for (let i = 0; i < Math.min(f.bytes.length, 1024); i++) {
        combinedBytes.push(f.bytes[i]);
      }
    }
    const contentHash = sha256(new Uint8Array(combinedBytes));

    const finalTitle = title?.trim() || files[0].filename.replace(/\.[^/.]+$/, "");

    // Save files to storage
    const fileRecords: { idx: number; key: string; mime: string; size: number }[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const s = sniffed[i];
      const ext = s.sniff.kind === "jpeg" ? "jpg" : s.sniff.kind;
      const fileId = generateId();
      const storageKey = `users/${userId}/sources/${sourceId}/${fileId}.${ext}`;

      await storage.saveFile(storageKey, f.bytes);
      fileRecords.push({
        idx: i,
        key: storageKey,
        mime: s.sniff.mime,
        size: f.bytes.length,
      });
    }

    const sourceRecord = await db.transaction(async (tx) => {
      const [src] = await tx
        .insert(schema.sources)
        .values({
          id: sourceId,
          userId,
          title: finalTitle,
          kind: sourceKind,
          originalFilenames: files.map((f) => f.filename),
          sizeBytes: totalSize,
          pageCount: sourceKind === "images" ? files.length : 1,
          fileCount: files.length,
          language: language || "unknown",
          charCount: 0,
          status: "queued",
          extraction: {
            method: null,
            quality: null,
            pagesTotal: sourceKind === "images" ? files.length : 1,
            pagesExtracted: 0,
            pagesFailed: [],
            warnings: [],
          },
          error: null,
          contentHash,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      for (const rec of fileRecords) {
        await tx.insert(schema.sourceFiles).values({
          sourceId,
          idx: rec.idx,
          storageKey: rec.key,
          mime: rec.mime,
          sizeBytes: rec.size,
        });
      }

      const [job] = await tx
        .insert(schema.jobs)
        .values({
          id: jobId,
          userId,
          type: "source_processing",
          status: "queued",
          stage: "validating",
          progress: 0,
          attempt: 0,
          maxAttempts: 3,
          payload: { sourceId, userId },
          createdAt: new Date(),
        })
        .returning();

      return { source: src, job };
    });

    return sourceRecord;
  }

  public async getSource(userId: string, sourceId: string) {
    const db = getDb();
    const [source] = await db
      .select()
      .from(schema.sources)
      .where(and(eq(schema.sources.id, sourceId), eq(schema.sources.userId, userId)));

    if (!source) {
      throw new AppError("NOT_FOUND", { message: "Source not found" });
    }

    const [job] = await db
      .select({ id: schema.jobs.id })
      .from(schema.jobs)
      .where(
        and(
          eq(schema.jobs.userId, userId),
          eq(schema.jobs.type, "source_processing"),
          sql`${schema.jobs.payload}->>'sourceId' = ${sourceId}`,
        ),
      )
      .orderBy(desc(schema.jobs.createdAt))
      .limit(1);
    return { ...source, jobId: job?.id ?? null };
  }

  public async updateSource(userId: string, sourceId: string, title: string) {
    const db = getDb();
    const [updated] = await db
      .update(schema.sources)
      .set({
        title: title.trim(),
        updatedAt: new Date(),
      })
      .where(and(eq(schema.sources.id, sourceId), eq(schema.sources.userId, userId)))
      .returning();

    if (!updated) {
      throw new AppError("NOT_FOUND", { message: "Source not found" });
    }

    return updated;
  }

  public async listSources(params: {
    userId: string;
    status?: string;
    kind?: string;
    q?: string;
    limit?: number;
    cursor?: string;
  }) {
    const db = getDb();
    const limit = Math.min(Math.max(params.limit || 20, 1), 50);

    const conditions = [eq(schema.sources.userId, params.userId)];

    if (params.status) {
      conditions.push(eq(schema.sources.status, params.status));
    }
    if (params.kind) {
      conditions.push(eq(schema.sources.kind, params.kind));
    }
    if (params.q) {
      conditions.push(ilike(schema.sources.title, `%${params.q.trim()}%`));
    }
    if (params.cursor) {
      const cursorDate = new Date(params.cursor);
      conditions.push(lt(schema.sources.createdAt, cursorDate));
    }

    const items = await db
      .select()
      .from(schema.sources)
      .where(and(...conditions))
      .orderBy(desc(schema.sources.createdAt))
      .limit(limit + 1);

    let nextCursor: string | null = null;
    if (items.length > limit) {
      const nextItem = items.pop()!;
      nextCursor = nextItem.createdAt.toISOString();
    }

    return { items, nextCursor };
  }

  public async getSourceFile(userId: string, sourceId: string, index: number) {
    const db = getDb();
    await this.getSource(userId, sourceId); // Verify ownership

    const [fileRecord] = await db
      .select()
      .from(schema.sourceFiles)
      .where(and(eq(schema.sourceFiles.sourceId, sourceId), eq(schema.sourceFiles.idx, index)));

    if (!fileRecord) {
      throw new AppError("NOT_FOUND", { message: "Source file not found at index" });
    }

    const bytes = await storage.getFile(fileRecord.storageKey);
    return { bytes, mime: fileRecord.mime };
  }

  public async getSourceText(params: {
    userId: string;
    sourceId: string;
    limit?: number;
    cursor?: string;
  }) {
    const { userId, sourceId } = params;
    const source = await this.getSource(userId, sourceId);

    if (
      source.status === "queued" ||
      source.status === "processing" ||
      source.status === "failed"
    ) {
      throw new AppError("SOURCE_NOT_READY", { message: "Source text is not ready" });
    }

    const db = getDb();
    const limit = Math.min(Math.max(params.limit || 20, 1), 50);
    const conditions = [eq(schema.sourceChunks.sourceId, sourceId)];

    if (params.cursor) {
      const cursorIdx = Number.parseInt(params.cursor, 10);
      conditions.push(gt(schema.sourceChunks.idx, cursorIdx));
    }

    const chunks = await db
      .select()
      .from(schema.sourceChunks)
      .where(and(...conditions))
      .orderBy(asc(schema.sourceChunks.idx))
      .limit(limit + 1);

    let nextCursor: string | null = null;
    if (chunks.length > limit) {
      const nextItem = chunks.pop()!;
      nextCursor = nextItem.idx.toString();
    }

    const items = chunks.map((c) => ({
      id: `c${c.idx}`,
      index: c.idx,
      page: c.page,
      text: c.text,
      charCount: c.charCount,
    }));

    return { items, nextCursor };
  }

  public async retrySource(userId: string, sourceId: string) {
    const source = await this.getSource(userId, sourceId);
    if (source.status !== "failed" && source.status !== "partial") {
      throw new AppError("JOB_NOT_RETRYABLE", {
        message: "Only failed or partial sources can be retried",
      });
    }

    const db = getDb();
    const jobId = generateId();

    const [job] = await db
      .insert(schema.jobs)
      .values({
        id: jobId,
        userId,
        type: "source_processing",
        status: "queued",
        stage: "validating",
        progress: 0,
        attempt: 0,
        maxAttempts: 3,
        payload: { sourceId, userId },
      })
      .returning();

    const [updatedSource] = await db
      .update(schema.sources)
      .set({
        status: "queued",
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.sources.id, sourceId))
      .returning();

    return { source: updatedSource, job };
  }

  public async deleteSource(userId: string, sourceId: string, keepMaterials = false) {
    const source = await this.getSource(userId, sourceId);
    const db = getDb();

    // 1. Delete stored files from disk
    const fileRecords = await db
      .select()
      .from(schema.sourceFiles)
      .where(eq(schema.sourceFiles.sourceId, sourceId));

    for (const rec of fileRecords) {
      await storage.deleteFile(rec.storageKey);
    }

    if (keepMaterials) {
      // Set sourceId=null on derived materials and strip sourceRefs quotes
      const derived = await db
        .select()
        .from(schema.materials)
        .where(eq(schema.materials.sourceId, sourceId));

      for (const mat of derived) {
        const content = mat.content as any;
        if (content && typeof content === "object") {
          stripQuotesFromRefs(content);
        }
        await db
          .update(schema.materials)
          .set({
            sourceId: null,
            content,
            updatedAt: new Date(),
          })
          .where(eq(schema.materials.id, mat.id));
      }
    } else {
      // Delete derived materials
      await db.delete(schema.materials).where(eq(schema.materials.sourceId, sourceId));
    }

    // Delete conversations with this source
    await db.delete(schema.conversations).where(eq(schema.conversations.sourceId, sourceId));

    // Finally delete source row
    await db.delete(schema.sources).where(eq(schema.sources.id, sourceId));
  }
}

function stripQuotesFromRefs(obj: any): void {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    for (const item of obj) stripQuotesFromRefs(item);
  } else {
    if ("sourceRefs" in obj && Array.isArray(obj.sourceRefs)) {
      for (const ref of obj.sourceRefs) {
        if (ref && typeof ref === "object") {
          ref.quote = null;
        }
      }
    }
    for (const key of Object.keys(obj)) {
      stripQuotesFromRefs(obj[key]);
    }
  }
}

export const sourceService = new SourceService();
