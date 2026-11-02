import { and, desc, eq, lt } from "drizzle-orm";
import { SYSTEM_PROMPT_V1 } from "../ai/prompts/system.v1.ts";
import { buildGradingTaskPrompt } from "../ai/prompts/tasks.v1.ts";
import { getGenerationProvider } from "../ai/providers/factory.ts";
import { type GradingOutput, GradingOutputSchema } from "../ai/schemas/grading.ts";
import { getDb, schema } from "../db/client.ts";
import { AppError } from "../lib/errors.ts";
import { type CardRating, computeNextLeitnerState } from "./leitner.ts";

export class StudyService {
  public async createSession(userId: string, materialId: string, mode: "flashcards" | "quiz") {
    const db = getDb();

    const [material] = await db
      .select()
      .from(schema.materials)
      .where(and(eq(schema.materials.id, materialId), eq(schema.materials.userId, userId)));

    if (!material) {
      throw new AppError("NOT_FOUND", { message: "Material not found" });
    }

    if (material.type !== mode) {
      throw new AppError("VALIDATION_ERROR", {
        message: `Session mode ${mode} does not match material type ${material.type}`,
      });
    }

    let itemsTotal = 0;
    const content = material.content as any;
    if (mode === "flashcards") {
      itemsTotal = (content?.cards || []).length;
    } else {
      itemsTotal = (content?.questions || []).length;
    }

    const [session] = await db
      .insert(schema.studySessions)
      .values({
        userId,
        materialId,
        mode,
        status: "active",
        itemsTotal,
        score: null,
      })
      .returning();

    return {
      id: session.id,
      materialId: session.materialId,
      mode: session.mode as "flashcards" | "quiz",
      status: session.status as "active" | "completed",
      itemsTotal: session.itemsTotal,
      itemsAnswered: 0,
      score: null,
      startedAt: session.startedAt.toISOString(),
      completedAt: null,
    };
  }

  public async getSession(userId: string, sessionId: string) {
    const db = getDb();
    const [session] = await db
      .select()
      .from(schema.studySessions)
      .where(and(eq(schema.studySessions.id, sessionId), eq(schema.studySessions.userId, userId)));

    if (!session) {
      throw new AppError("NOT_FOUND", { message: "Study session not found" });
    }

    const answers = await db
      .select()
      .from(schema.studyAnswers)
      .where(eq(schema.studyAnswers.sessionId, sessionId));

    return {
      session: {
        id: session.id,
        materialId: session.materialId,
        mode: session.mode as "flashcards" | "quiz",
        status: session.status as "active" | "completed",
        itemsTotal: session.itemsTotal,
        itemsAnswered: answers.length,
        score: session.score ? Number.parseFloat(session.score) : null,
        startedAt: session.startedAt.toISOString(),
        completedAt: session.completedAt ? session.completedAt.toISOString() : null,
      },
      answers: answers.map((a) => ({
        itemId: a.itemId,
        verdict: a.verdict,
        rating: a.rating,
        answeredAt: a.answeredAt.toISOString(),
      })),
    };
  }

  public async listSessions(params: {
    userId: string;
    materialId?: string;
    limit?: number;
    cursor?: string;
  }) {
    const db = getDb();
    const limit = Math.min(Math.max(params.limit || 20, 1), 50);

    const conditions = [eq(schema.studySessions.userId, params.userId)];
    if (params.materialId) {
      conditions.push(eq(schema.studySessions.materialId, params.materialId));
    }
    if (params.cursor) {
      conditions.push(lt(schema.studySessions.startedAt, new Date(params.cursor)));
    }

    const sessions = await db
      .select()
      .from(schema.studySessions)
      .where(and(...conditions))
      .orderBy(desc(schema.studySessions.startedAt))
      .limit(limit + 1);

    let nextCursor: string | null = null;
    if (sessions.length > limit) {
      const next = sessions.pop()!;
      nextCursor = next.startedAt.toISOString();
    }

    const items = await Promise.all(
      sessions.map(async (s) => {
        const answers = await db
          .select({ id: schema.studyAnswers.id })
          .from(schema.studyAnswers)
          .where(eq(schema.studyAnswers.sessionId, s.id));

        return {
          id: s.id,
          materialId: s.materialId,
          mode: s.mode,
          status: s.status,
          itemsTotal: s.itemsTotal,
          itemsAnswered: answers.length,
          score: s.score ? Number.parseFloat(s.score) : null,
          startedAt: s.startedAt.toISOString(),
          completedAt: s.completedAt ? s.completedAt.toISOString() : null,
        };
      }),
    );

    return { items, nextCursor };
  }

  public async recordAnswer(params: {
    userId: string;
    sessionId: string;
    itemId: string;
    rating?: CardRating;
    choiceId?: string;
    text?: string;
  }) {
    const { userId, sessionId, itemId, rating, choiceId, text } = params;
    const db = getDb();

    const { session } = await this.getSession(userId, sessionId);

    // Check if item already answered in this session (idempotent)
    const [existingAnswer] = await db
      .select()
      .from(schema.studyAnswers)
      .where(
        and(eq(schema.studyAnswers.sessionId, sessionId), eq(schema.studyAnswers.itemId, itemId)),
      );

    if (existingAnswer) {
      return {
        itemId: existingAnswer.itemId,
        verdict: existingAnswer.verdict as any,
        correctChoiceId: existingAnswer.choiceId,
        explanation: null,
        feedback: existingAnswer.feedback,
        nextDueAt: null,
      };
    }

    const [material] = await db
      .select()
      .from(schema.materials)
      .where(eq(schema.materials.id, session.materialId));

    if (!material) {
      throw new AppError("NOT_FOUND", { message: "Material not found" });
    }

    if (session.mode === "flashcards") {
      if (!rating) {
        throw new AppError("VALIDATION_ERROR", { message: "Rating is required for flashcards" });
      }

      // Load existing card progress
      const [existingProgress] = await db
        .select()
        .from(schema.cardProgress)
        .where(
          and(
            eq(schema.cardProgress.userId, userId),
            eq(schema.cardProgress.materialId, session.materialId),
            eq(schema.cardProgress.cardId, itemId),
          ),
        );

      const nextState = computeNextLeitnerState(
        existingProgress
          ? {
              box: existingProgress.box,
              dueAt: existingProgress.dueAt,
              lastRating: existingProgress.lastRating as any,
            }
          : null,
        rating,
      );

      await db.transaction(async (tx) => {
        // Upsert card progress
        await tx
          .insert(schema.cardProgress)
          .values({
            userId,
            materialId: session.materialId,
            cardId: itemId,
            box: nextState.box,
            dueAt: nextState.dueAt,
            lastRating: nextState.lastRating,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [
              schema.cardProgress.userId,
              schema.cardProgress.materialId,
              schema.cardProgress.cardId,
            ],
            set: {
              box: nextState.box,
              dueAt: nextState.dueAt,
              lastRating: nextState.lastRating,
              updatedAt: new Date(),
            },
          });

        await tx.insert(schema.studyAnswers).values({
          sessionId,
          itemId,
          rating,
          verdict: null,
        });
      });

      return {
        itemId,
        verdict: null,
        correctChoiceId: null,
        explanation: null,
        feedback: null,
        nextDueAt: nextState.dueAt.toISOString(),
      };
    }

    // Quiz answer handling
    const questions = (material.content as any)?.questions || [];
    const question = questions.find((q: any) => q.id === itemId);

    if (!question) {
      throw new AppError("NOT_FOUND", { message: "Question not found in material" });
    }

    let verdict: "correct" | "partially_correct" | "incorrect" = "incorrect";
    let feedback: string | null = null;
    let correctChoiceId: string | null = null;

    if (question.type === "multiple_choice" || question.type === "true_false") {
      correctChoiceId = question.correctChoiceId;
      verdict = choiceId === question.correctChoiceId ? "correct" : "incorrect";
    } else if (question.type === "short_answer") {
      const studentInput = (text || "").trim();
      const acceptedAnswers = question.acceptedAnswers || [];

      // Normalized deterministic match first
      const normalizedStudent = normalizeForGrading(studentInput);
      const isAccepted = acceptedAnswers.some(
        (acc: string) => normalizeForGrading(acc) === normalizedStudent,
      );

      if (isAccepted) {
        verdict = "correct";
        feedback = "คำตอบถูกต้องตรงตามเกณฑ์";
      } else {
        // Call Gemini grading task
        const provider = getGenerationProvider();
        const abortController = new AbortController();
        const timer = setTimeout(() => abortController.abort(), 30000);

        try {
          const gradingPrompt = buildGradingTaskPrompt({
            question: question.prompt,
            modelAnswer: question.modelAnswer || acceptedAnswers[0] || "",
            acceptedAnswers,
            studentAnswer: studentInput,
          });

          const res = await provider.generateJson<GradingOutput>(
            {
              system: `${SYSTEM_PROMPT_V1}\n\n${gradingPrompt}`,
              user: `STUDENT ANSWER TO EVALUATE: ${studentInput}`,
              schema: GradingOutputSchema,
              schemaName: "GradingOutput",
            },
            { signal: abortController.signal },
          );

          verdict = res.data.verdict;
          feedback = res.data.feedback;
        } finally {
          clearTimeout(timer);
        }
      }
    }

    await db.insert(schema.studyAnswers).values({
      sessionId,
      itemId,
      verdict,
      choiceId: choiceId || null,
      answerText: text || null,
      feedback,
    });

    return {
      itemId,
      verdict,
      correctChoiceId,
      explanation: question.explanation || null,
      feedback,
      nextDueAt: null,
    };
  }

  public async completeSession(userId: string, sessionId: string) {
    const db = getDb();
    const { session } = await this.getSession(userId, sessionId);

    if (session.status === "completed") {
      return session;
    }

    const answers = await db
      .select()
      .from(schema.studyAnswers)
      .where(eq(schema.studyAnswers.sessionId, sessionId));

    let score: number | null = null;
    if (session.mode === "quiz" && session.itemsTotal > 0) {
      let totalPoints = 0;
      for (const a of answers) {
        if (a.verdict === "correct") totalPoints += 1.0;
        else if (a.verdict === "partially_correct") totalPoints += 0.5;
      }
      score = Number.parseFloat((totalPoints / session.itemsTotal).toFixed(4));
    }

    const [updated] = await db
      .update(schema.studySessions)
      .set({
        status: "completed",
        score: score !== null ? score.toString() : null,
        completedAt: new Date(),
      })
      .where(eq(schema.studySessions.id, sessionId))
      .returning();

    return {
      id: updated.id,
      materialId: updated.materialId,
      mode: updated.mode as "flashcards" | "quiz",
      status: "completed" as const,
      itemsTotal: updated.itemsTotal,
      itemsAnswered: answers.length,
      score: score,
      startedAt: updated.startedAt.toISOString(),
      completedAt: updated.completedAt ? updated.completedAt.toISOString() : null,
    };
  }
}

function normalizeForGrading(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"' ]/g, "")
    .trim();
}

export const studyService = new StudyService();
