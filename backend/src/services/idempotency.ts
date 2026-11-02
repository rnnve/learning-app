import { and, eq } from "drizzle-orm";
import { getDb, schema } from "../db/client.ts";
import { AppError } from "../lib/errors.ts";
import { sha256 } from "../lib/hash.ts";
import { isValidUuid } from "../lib/ids.ts";

export interface IdempotencyCheckResult {
  isReplay: boolean;
  statusCode?: number;
  responseBody?: any;
}

export class IdempotencyService {
  public async begin(
    userId: string,
    key: string,
    method: string,
    path: string,
    body: any,
  ): Promise<IdempotencyCheckResult> {
    if (!key || !isValidUuid(key)) {
      throw new AppError("VALIDATION_ERROR", {
        message: "A valid UUID Idempotency-Key header is required",
      });
    }

    const db = getDb();
    const requestHash = sha256(JSON.stringify(body || {}));

    const [existing] = await db
      .select()
      .from(schema.idempotencyKeys)
      .where(and(eq(schema.idempotencyKeys.userId, userId), eq(schema.idempotencyKeys.key, key)));

    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new AppError("IDEMPOTENCY_KEY_REUSED", {
          message: "Idempotency key reused with different request body",
        });
      }

      if (existing.status === null) {
        throw new AppError("REQUEST_IN_PROGRESS", {
          message: "Duplicate request is already in progress",
        });
      }

      return {
        isReplay: true,
        statusCode: existing.status,
        responseBody: existing.responseBody,
      };
    }

    // Insert in-flight marker
    await db.insert(schema.idempotencyKeys).values({
      userId,
      key,
      method,
      path,
      requestHash,
      status: null,
      responseBody: null,
    });

    return { isReplay: false };
  }

  public async complete(
    userId: string,
    key: string,
    status: number,
    responseBody: any,
  ): Promise<void> {
    const db = getDb();
    await db
      .update(schema.idempotencyKeys)
      .set({
        status,
        responseBody,
      })
      .where(and(eq(schema.idempotencyKeys.userId, userId), eq(schema.idempotencyKeys.key, key)));
  }

  public async release(userId: string, key: string): Promise<void> {
    const db = getDb();
    await db
      .delete(schema.idempotencyKeys)
      .where(and(eq(schema.idempotencyKeys.userId, userId), eq(schema.idempotencyKeys.key, key)));
  }
}

export const idempotencyService = new IdempotencyService();
