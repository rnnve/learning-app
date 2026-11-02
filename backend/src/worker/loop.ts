import { and, eq, lte, or, sql } from "drizzle-orm";
import { env } from "../config/env.ts";
import { getDb, schema } from "../db/client.ts";
import { AppError, formatErrorBody } from "../lib/errors.ts";
import { logger } from "../lib/logger.ts";
import { processGenerateJob } from "./handlers/generate.ts";
import { processSourceJob } from "./handlers/sourceProcessing.ts";

function getErrorContext(err: unknown): {
  error: string;
  errorName?: string;
  errorCode?: string;
} {
  if (err instanceof Error) {
    const candidate = err as Error & { code?: unknown };
    return {
      // Some database/network errors have an empty `message`. Keep a useful
      // fallback so operational logs never hide the reason for a worker failure.
      error: candidate.message || candidate.name || "Unknown error",
      ...(candidate.name ? { errorName: candidate.name } : {}),
      ...(typeof candidate.code === "string" ? { errorCode: candidate.code } : {}),
    };
  }

  return {
    error: typeof err === "string" ? err : "Unknown non-Error failure",
  };
}

export class WorkerLoop {
  private isRunning = false;
  private workerId: string;
  private concurrency: number;
  private pollIntervalMs: number;
  private activeJobsCount = 0;
  private lastStaleCheck = 0;
  private abortControllers = new Map<string, AbortController>();

  constructor(options?: { concurrency?: number; pollIntervalMs?: number }) {
    this.workerId = `worker-${Math.random().toString(36).substring(2, 9)}`;
    this.concurrency = options?.concurrency ?? env.WORKER_CONCURRENCY;
    this.pollIntervalMs = options?.pollIntervalMs ?? 1000;
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info("Starting background worker loop", {
      workerId: this.workerId,
      concurrency: this.concurrency,
    });

    // Requeue abandoned stale jobs on boot
    await this.requeueStaleJobs();

    this.runLoop();
  }

  public stop(): void {
    this.isRunning = false;
    for (const controller of this.abortControllers.values()) {
      controller.abort();
    }
    this.abortControllers.clear();
    logger.info("Worker loop stopped", { workerId: this.workerId });
  }

  public cancelJob(jobId: string): boolean {
    const controller = this.abortControllers.get(jobId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(jobId);
      return true;
    }
    return false;
  }

  private async runLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        if (Date.now() - this.lastStaleCheck >= 30000) {
          await this.requeueStaleJobs();
          this.lastStaleCheck = Date.now();
        }
        if (this.activeJobsCount < this.concurrency) {
          const availableSlots = this.concurrency - this.activeJobsCount;
          const claimedJobs = await this.claimJobs(availableSlots);

          for (const job of claimedJobs) {
            this.activeJobsCount++;
            this.executeJob(job).finally(() => {
              this.activeJobsCount--;
            });
          }
        }
      } catch (err: unknown) {
        logger.error("Error in worker polling loop", getErrorContext(err));
      }

      await Bun.sleep(this.pollIntervalMs);
    }
  }

  private async claimJobs(limit: number): Promise<(typeof schema.jobs.$inferSelect)[]> {
    const db = getDb();
    const now = new Date();
    const leaseTime = new Date(now.getTime() + 60 * 1000);

    return await db.transaction(async (tx) => {
      const candidates = await tx
        .select()
        .from(schema.jobs)
        .where(and(eq(schema.jobs.status, "queued"), lte(schema.jobs.runAfter, now)))
        .limit(limit)
        .for("update", { skipLocked: true });

      if (candidates.length === 0) return [];

      const claimed: (typeof schema.jobs.$inferSelect)[] = [];
      for (const job of candidates) {
        const [updated] = await tx
          .update(schema.jobs)
          .set({
            status: "running",
            lockedBy: this.workerId,
            leaseExpiresAt: leaseTime,
            heartbeatAt: now,
            startedAt: job.startedAt || now,
          })
          .where(eq(schema.jobs.id, job.id))
          .returning();
        claimed.push(updated);
      }
      return claimed;
    });
  }

  private async executeJob(job: typeof schema.jobs.$inferSelect): Promise<void> {
    const db = getDb();
    const controller = new AbortController();
    this.abortControllers.set(job.id, controller);

    // Heartbeat timer every 20 seconds
    const heartbeatTimer = setInterval(async () => {
      try {
        const now = new Date();
        const leaseTime = new Date(now.getTime() + 60 * 1000);
        await db
          .update(schema.jobs)
          .set({
            heartbeatAt: now,
            leaseExpiresAt: leaseTime,
          })
          .where(eq(schema.jobs.id, job.id));
      } catch {
        // Ignore heartbeat error
      }
    }, 20000);

    const updateProgress = async (stage: string, progress: number, detail?: any) => {
      await db
        .update(schema.jobs)
        .set({
          stage,
          progress,
          detail: detail ? detail : sql`detail`,
        })
        .where(eq(schema.jobs.id, job.id));
    };

    try {
      let result: any = null;

      if (job.type === "source_processing") {
        result = await processSourceJob(
          job.id,
          job.payload as any,
          updateProgress,
          controller.signal,
        );
      } else if (
        job.type === "generate_summary" ||
        job.type === "generate_flashcards" ||
        job.type === "generate_quiz"
      ) {
        result = await processGenerateJob(
          job.id,
          job.payload as any,
          updateProgress,
          controller.signal,
        );
      } else {
        throw new AppError("INTERNAL_ERROR", { message: `Unknown job type: ${job.type}` });
      }

      await db
        .update(schema.jobs)
        .set({
          status: "succeeded",
          progress: 100,
          result,
          error: null,
          lockedBy: null,
          leaseExpiresAt: null,
          finishedAt: new Date(),
        })
        .where(eq(schema.jobs.id, job.id));
    } catch (err: any) {
      const isAbort = controller.signal.aborted || err.name === "AbortError";
      const appErr =
        err instanceof AppError
          ? err
          : new AppError(isAbort ? "AI_TIMEOUT" : "INTERNAL_ERROR", { message: err.message });

      const newAttempt = (job.attempt || 0) + 1;
      const canRetry = appErr.retryable && newAttempt < job.maxAttempts && !isAbort;

      const errorBody = formatErrorBody(appErr.code, "th", appErr.details);

      if (canRetry) {
        const backoffSec = newAttempt === 1 ? 10 : 40;
        const nextRun = new Date(Date.now() + backoffSec * 1000);

        await db
          .update(schema.jobs)
          .set({
            status: "queued",
            attempt: newAttempt,
            runAfter: nextRun,
            lockedBy: null,
            leaseExpiresAt: null,
            error: errorBody,
          })
          .where(eq(schema.jobs.id, job.id));
      } else {
        const finalStatus = isAbort ? "canceled" : "failed";
        await db
          .update(schema.jobs)
          .set({
            status: finalStatus,
            attempt: newAttempt,
            lockedBy: null,
            leaseExpiresAt: null,
            finishedAt: new Date(),
            error: errorBody,
          })
          .where(eq(schema.jobs.id, job.id));

        // If source processing failed, mirror error to sources table
        if (job.type === "source_processing" && (job.payload as any)?.sourceId) {
          await db
            .update(schema.sources)
            .set({
              status: "failed",
              error: errorBody,
              updatedAt: new Date(),
            })
            .where(eq(schema.sources.id, (job.payload as any).sourceId));
        }
      }
    } finally {
      clearInterval(heartbeatTimer);
      this.abortControllers.delete(job.id);
    }
  }

  private async requeueStaleJobs(): Promise<void> {
    try {
      const db = getDb();
      const now = new Date();
      await db
        .update(schema.jobs)
        .set({
          status: "queued",
          lockedBy: null,
          leaseExpiresAt: null,
        })
        .where(and(eq(schema.jobs.status, "running"), lte(schema.jobs.leaseExpiresAt, now)));
    } catch {
      // Ignore on boot before tables ready
    }
  }
}

export const worker = new WorkerLoop();
