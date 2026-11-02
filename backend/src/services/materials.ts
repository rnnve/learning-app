import { and, desc, eq, ilike, lt } from "drizzle-orm";
import { getDb, schema } from "../db/client.ts";
import { AppError } from "../lib/errors.ts";
import { sha256 } from "../lib/hash.ts";
import { generateId } from "../lib/ids.ts";
import { computeNextLeitnerState } from "./leitner.ts";
import { checkAndIncrementGenerationQuota } from "./quota.ts";

export class MaterialService {
  public async createMaterial(params: {
    userId: string;
    type: "summary" | "flashcards" | "quiz";
    sourceId: string;
    title?: string;
    options: Record<string, any>;
  }) {
    const { userId, type, sourceId, title, options } = params;
    const db = getDb();

    // 1. Consent check
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    if (!user || !user.consentVersion) {
      throw new AppError("CONSENT_REQUIRED", { message: "AI consent required" });
    }

    // 2. Source ready check
    const [source] = await db
      .select()
      .from(schema.sources)
      .where(and(eq(schema.sources.id, sourceId), eq(schema.sources.userId, userId)));

    if (!source) {
      throw new AppError("NOT_FOUND", { message: "Source not found" });
    }

    if (source.status !== "ready" && source.status !== "partial") {
      throw new AppError("SOURCE_NOT_READY", { message: "Source is not ready for generation" });
    }

    // 3. Deduplication check: same user, source, type, normalized options
    const normalizedOptions = JSON.stringify(options || {});
    const dedupeKey = sha256(`${userId}:${sourceId}:${type}:${normalizedOptions}`);

    const existingJobs = await db
      .select()
      .from(schema.jobs)
      .where(and(eq(schema.jobs.userId, userId), eq(schema.jobs.dedupeKey, dedupeKey)));

    const activeJob = existingJobs.find((j) => j.status === "queued" || j.status === "running");
    if (activeJob) {
      return { job: activeJob };
    }

    // 4. Increment generation quota
    await checkAndIncrementGenerationQuota(userId);

    // 5. Enqueue job
    const jobId = generateId();
    const jobType = `generate_${type}` as any;

    const [job] = await db
      .insert(schema.jobs)
      .values({
        id: jobId,
        userId,
        type: jobType,
        status: "queued",
        stage: "preparing_context",
        progress: 0,
        attempt: 0,
        maxAttempts: 3,
        dedupeKey,
        payload: {
          sourceId,
          userId,
          type,
          title,
          options,
        },
      })
      .returning();

    return { job };
  }

  public async getMaterial(userId: string, materialId: string) {
    const db = getDb();
    const [material] = await db
      .select()
      .from(schema.materials)
      .where(and(eq(schema.materials.id, materialId), eq(schema.materials.userId, userId)));

    if (!material) {
      throw new AppError("NOT_FOUND", { message: "Material not found" });
    }

    return material;
  }

  public async updateMaterial(params: {
    userId: string;
    materialId: string;
    title?: string;
    isSaved?: boolean;
  }) {
    const { userId, materialId, title, isSaved } = params;
    const db = getDb();

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title.trim();
    if (isSaved !== undefined) updates.isSaved = isSaved;

    const [updated] = await db
      .update(schema.materials)
      .set(updates)
      .where(and(eq(schema.materials.id, materialId), eq(schema.materials.userId, userId)))
      .returning();

    if (!updated) {
      throw new AppError("NOT_FOUND", { message: "Material not found" });
    }

    return updated;
  }

  public async listMaterials(params: {
    userId: string;
    type?: string;
    sourceId?: string;
    saved?: boolean;
    q?: string;
    limit?: number;
    cursor?: string;
  }) {
    const db = getDb();
    const limit = Math.min(Math.max(params.limit || 20, 1), 50);

    const conditions = [eq(schema.materials.userId, params.userId)];

    if (params.type) {
      conditions.push(eq(schema.materials.type, params.type));
    }
    if (params.sourceId) {
      conditions.push(eq(schema.materials.sourceId, params.sourceId));
    }
    if (params.saved !== undefined) {
      conditions.push(eq(schema.materials.isSaved, params.saved));
    }
    if (params.q) {
      conditions.push(ilike(schema.materials.title, `%${params.q.trim()}%`));
    }
    if (params.cursor) {
      const cursorDate = new Date(params.cursor);
      conditions.push(lt(schema.materials.createdAt, cursorDate));
    }

    const items = await db
      .select()
      .from(schema.materials)
      .where(and(...conditions))
      .orderBy(desc(schema.materials.createdAt))
      .limit(limit + 1);

    let nextCursor: string | null = null;
    if (items.length > limit) {
      const nextItem = items.pop()!;
      nextCursor = nextItem.createdAt.toISOString();
    }

    // Transform to MaterialSummary (no content, add itemCount)
    const summaryItems = items.map((m) => {
      let itemCount = 0;
      const content = m.content as any;
      if (m.type === "summary") {
        itemCount = (content?.keyPoints || []).length;
      } else if (m.type === "flashcards") {
        itemCount = (content?.cards || []).length;
      } else if (m.type === "quiz") {
        itemCount = (content?.questions || []).length;
      }

      const { content: _, ...rest } = m;
      return {
        ...rest,
        itemCount,
      };
    });

    return { items: summaryItems, nextCursor };
  }

  public async deleteMaterial(userId: string, materialId: string) {
    const db = getDb();
    await this.getMaterial(userId, materialId); // verify ownership
    await db.delete(schema.materials).where(eq(schema.materials.id, materialId));
  }

  public async getFlashcardProgress(userId: string, materialId: string) {
    const material = await this.getMaterial(userId, materialId);
    if (material.type !== "flashcards") {
      throw new AppError("VALIDATION_ERROR", { message: "Material is not a flashcards deck" });
    }

    const db = getDb();
    const cards = (material.content as any)?.cards || [];

    const existingProgress = await db
      .select()
      .from(schema.cardProgress)
      .where(
        and(eq(schema.cardProgress.userId, userId), eq(schema.cardProgress.materialId, materialId)),
      );

    const progressMap = new Map(existingProgress.map((p) => [p.cardId, p]));
    const now = new Date().toISOString();

    const items = cards.map((c: any) => {
      const prog = progressMap.get(c.id);
      if (prog) {
        return {
          cardId: prog.cardId,
          dueAt: prog.dueAt.toISOString(),
          box: prog.box,
          lastRating: prog.lastRating,
        };
      }
      // Unreviewed card returns dueAt = now, box = 1
      return {
        cardId: c.id,
        dueAt: now,
        box: 1,
        lastRating: null,
      };
    });

    return { items };
  }
}

export const materialService = new MaterialService();
