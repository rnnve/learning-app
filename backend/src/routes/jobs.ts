import { and, desc, eq, or } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { getDb, schema } from "../db/client.ts";
import { AppError } from "../lib/errors.ts";
import { authPlugin } from "../plugins/auth.ts";
import { worker } from "../worker/loop.ts";

export const jobRoutes = new Elysia({ prefix: "/v1/jobs" })
  .use(authPlugin)
  .get(
    "/:id",
    async ({ user, params }) => {
      const db = getDb();
      const [job] = await db
        .select()
        .from(schema.jobs)
        .where(and(eq(schema.jobs.id, params.id), eq(schema.jobs.userId, user.id)));

      if (!job) {
        throw new AppError("NOT_FOUND", { message: "Job not found" });
      }

      return {
        sourceId: (job.payload as { sourceId?: string } | null)?.sourceId ?? null,
        materialId: (job.payload as { materialId?: string } | null)?.materialId ?? null,
        id: job.id,
        type: job.type,
        status: job.status,
        stage: job.stage,
        progress: job.progress,
        detail: job.detail,
        attempt: job.attempt,
        error: job.error,
        result: job.result,
        createdAt: job.createdAt.toISOString(),
        startedAt: job.startedAt ? job.startedAt.toISOString() : null,
        finishedAt: job.finishedAt ? job.finishedAt.toISOString() : null,
      };
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        tags: ["Jobs"],
        summary: "Get background job status",
      },
    },
  )
  .get(
    "",
    async ({ user, query }) => {
      const db = getDb();
      const conditions = [eq(schema.jobs.userId, user.id)];

      if (query.active === "true") {
        conditions.push(or(eq(schema.jobs.status, "queued"), eq(schema.jobs.status, "running"))!);
      }

      const jobs = await db
        .select()
        .from(schema.jobs)
        .where(and(...conditions))
        .orderBy(desc(schema.jobs.createdAt));

      return {
        items: jobs.map((job) => ({
          sourceId: (job.payload as { sourceId?: string } | null)?.sourceId ?? null,
          materialId: (job.payload as { materialId?: string } | null)?.materialId ?? null,
          id: job.id,
          type: job.type,
          status: job.status,
          stage: job.stage,
          progress: job.progress,
          detail: job.detail,
          attempt: job.attempt,
          error: job.error,
          result: job.result,
          createdAt: job.createdAt.toISOString(),
          startedAt: job.startedAt ? job.startedAt.toISOString() : null,
          finishedAt: job.finishedAt ? job.finishedAt.toISOString() : null,
        })),
      };
    },
    {
      query: t.Object({
        active: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Jobs"],
        summary: "List user jobs",
      },
    },
  )
  .post(
    "/:id/retry",
    async ({ user, params, set }) => {
      const db = getDb();
      const [job] = await db
        .select()
        .from(schema.jobs)
        .where(and(eq(schema.jobs.id, params.id), eq(schema.jobs.userId, user.id)));

      if (!job) {
        throw new AppError("NOT_FOUND", { message: "Job not found" });
      }

      const errBody = job.error as any;
      if (job.status !== "failed" || !errBody?.retryable) {
        throw new AppError("JOB_NOT_RETRYABLE", {
          message: "Job is not in a retryable state",
        });
      }

      const [updated] = await db
        .update(schema.jobs)
        .set({
          status: "queued",
          attempt: 0,
          stage: "validating",
          progress: 0,
          error: null,
          runAfter: new Date(),
        })
        .where(eq(schema.jobs.id, job.id))
        .returning();

      set.status = 202;
      return {
        id: updated.id,
        type: updated.type,
        status: updated.status,
        stage: updated.stage,
        progress: updated.progress,
        detail: updated.detail,
        attempt: updated.attempt,
        error: updated.error,
        result: updated.result,
        createdAt: updated.createdAt.toISOString(),
        startedAt: updated.startedAt ? updated.startedAt.toISOString() : null,
        finishedAt: updated.finishedAt ? updated.finishedAt.toISOString() : null,
      };
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        tags: ["Jobs"],
        summary: "Retry a failed job",
      },
    },
  )
  .post(
    "/:id/cancel",
    async ({ user, params }) => {
      const db = getDb();
      const [job] = await db
        .select()
        .from(schema.jobs)
        .where(and(eq(schema.jobs.id, params.id), eq(schema.jobs.userId, user.id)));

      if (!job) {
        throw new AppError("NOT_FOUND", { message: "Job not found" });
      }

      if (job.status !== "queued" && job.status !== "running") {
        throw new AppError("JOB_NOT_RETRYABLE", {
          message: "Job is not queued or running and cannot be canceled",
        });
      }

      worker.cancelJob(job.id);

      const [updated] = await db
        .update(schema.jobs)
        .set({
          status: "canceled",
          finishedAt: new Date(),
        })
        .where(eq(schema.jobs.id, job.id))
        .returning();

      return {
        id: updated.id,
        type: updated.type,
        status: updated.status,
        stage: updated.stage,
        progress: updated.progress,
        detail: updated.detail,
        attempt: updated.attempt,
        error: updated.error,
        result: updated.result,
        createdAt: updated.createdAt.toISOString(),
        startedAt: updated.startedAt ? updated.startedAt.toISOString() : null,
        finishedAt: updated.finishedAt ? updated.finishedAt.toISOString() : null,
      };
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        tags: ["Jobs"],
        summary: "Cancel a queued or running job",
      },
    },
  );
