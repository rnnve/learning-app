import { eq } from "drizzle-orm";
import { generateMaterial } from "../../ai/pipeline/generate.ts";
import { getGenerationProvider } from "../../ai/providers/factory.ts";
import { getDb, schema } from "../../db/client.ts";
import { AppError } from "../../lib/errors.ts";
import type { ChunkItem } from "../../processing/retrieval.ts";

export interface GenerateJobPayload {
  materialId?: string;
  sourceId: string;
  userId: string;
  type: "summary" | "flashcards" | "quiz";
  title?: string;
  options: Record<string, any>;
}

export async function processGenerateJob(
  jobId: string,
  payload: GenerateJobPayload,
  updateProgress: (stage: string, progress: number, detail?: any) => Promise<void>,
  signal: AbortSignal,
): Promise<{ materialId: string }> {
  const db = getDb();
  const { sourceId, userId, type, options, title } = payload;

  await updateProgress("preparing_context", 15);

  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  if (!user) {
    throw new AppError("NOT_FOUND", { message: "User not found" });
  }

  const [source] = await db.select().from(schema.sources).where(eq(schema.sources.id, sourceId));
  if (!source) {
    throw new AppError("NOT_FOUND", { message: "Source not found" });
  }

  if (source.status !== "ready" && source.status !== "partial") {
    throw new AppError("SOURCE_NOT_READY", { message: "Source is not ready for generation" });
  }

  const rawChunks = await db
    .select()
    .from(schema.sourceChunks)
    .where(eq(schema.sourceChunks.sourceId, sourceId))
    .orderBy(schema.sourceChunks.idx);

  const chunks: ChunkItem[] = rawChunks.map((c) => ({
    id: `c${c.idx}`,
    index: c.idx,
    page: c.page,
    text: c.text,
    charCount: c.charCount,
  }));

  await updateProgress("generating", 45);

  const provider = getGenerationProvider();
  const result = await generateMaterial(
    {
      type,
      sourceId,
      sourceTitle: source.title,
      sourceLanguage: source.language,
      options,
      chunks,
      userPreferences: (user.preferences as any) || {},
    },
    provider,
    signal,
  );

  await updateProgress("validating_output", 80);

  await updateProgress("saving", 95);

  const finalTitle = title?.trim() || result.title;

  let materialId = payload.materialId;

  await db.transaction(async (tx) => {
    if (materialId) {
      await tx
        .update(schema.materials)
        .set({
          title: finalTitle,
          content: result.content,
          options: result.options,
          generatedBy: result.generatedBy,
          updatedAt: new Date(),
        })
        .where(eq(schema.materials.id, materialId));
    } else {
      const [inserted] = await tx
        .insert(schema.materials)
        .values({
          userId,
          sourceId,
          type,
          title: finalTitle,
          content: result.content,
          options: result.options,
          isSaved: false,
          generatedBy: result.generatedBy,
        })
        .returning({ id: schema.materials.id });
      materialId = inserted.id;
    }
  });

  return { materialId: materialId! };
}
