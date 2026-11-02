import { and, desc, eq, gte, or } from "drizzle-orm";
import { Elysia } from "elysia";
import { getDb, schema } from "../db/client.ts";
import { authPlugin } from "../plugins/auth.ts";

export const homeRoutes = new Elysia({ prefix: "/v1" }).use(authPlugin).get(
  "/home",
  async ({ user }) => {
    const db = getDb();
    const userId = user.id;

    // Stats
    const userSources = await db
      .select({ id: schema.sources.id })
      .from(schema.sources)
      .where(eq(schema.sources.userId, userId));

    const userMaterials = await db
      .select({ id: schema.materials.id })
      .from(schema.materials)
      .where(eq(schema.materials.userId, userId));

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentSessions = await db
      .select({ id: schema.studySessions.id })
      .from(schema.studySessions)
      .where(
        and(
          eq(schema.studySessions.userId, userId),
          gte(schema.studySessions.startedAt, sevenDaysAgo),
        ),
      );

    // Active jobs
    const activeJobs = await db
      .select()
      .from(schema.jobs)
      .where(
        and(
          eq(schema.jobs.userId, userId),
          or(eq(schema.jobs.status, "queued"), eq(schema.jobs.status, "running")),
        ),
      )
      .orderBy(desc(schema.jobs.createdAt));

    // Recent sources (max 5)
    const recentSources = await db
      .select()
      .from(schema.sources)
      .where(eq(schema.sources.userId, userId))
      .orderBy(desc(schema.sources.createdAt))
      .limit(5);

    // Recent materials (max 5, summary format)
    const materials = await db
      .select()
      .from(schema.materials)
      .where(eq(schema.materials.userId, userId))
      .orderBy(desc(schema.materials.createdAt))
      .limit(5);

    const recentMaterials = materials.map((m) => {
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

    return {
      stats: {
        sources: userSources.length,
        materials: userMaterials.length,
        sessionsLast7Days: recentSessions.length,
      },
      activeJobs: activeJobs.map((j) => ({
        sourceId: (j.payload as { sourceId?: string } | null)?.sourceId ?? null,
        materialId: (j.payload as { materialId?: string } | null)?.materialId ?? null,
        id: j.id,
        type: j.type,
        status: j.status,
        stage: j.stage,
        progress: j.progress,
        detail: j.detail,
        attempt: j.attempt,
        error: j.error,
        result: j.result,
        createdAt: j.createdAt.toISOString(),
        startedAt: j.startedAt ? j.startedAt.toISOString() : null,
        finishedAt: j.finishedAt ? j.finishedAt.toISOString() : null,
      })),
      recentSources: recentSources.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      })),
      recentMaterials: recentMaterials.map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
      })),
    };
  },
  {
    detail: {
      tags: ["Home"],
      summary: "Get home dashboard stats and recent items",
    },
  },
);
