import { and, eq, sql } from "drizzle-orm";
import { env } from "../config/env.ts";
import { getDb, schema } from "../db/client.ts";
import { AppError } from "../lib/errors.ts";
import { getBangkokDateString, getBangkokMidnightIso } from "../lib/time.ts";

export async function checkAndIncrementGenerationQuota(userId: string): Promise<void> {
  const db = getDb();
  const today = getBangkokDateString();

  const [counter] = await db
    .select()
    .from(schema.usageCounters)
    .where(and(eq(schema.usageCounters.userId, userId), eq(schema.usageCounters.day, today)));

  if (counter && counter.generations >= env.MAX_GENERATIONS_PER_DAY) {
    throw new AppError("QUOTA_EXCEEDED", {
      message: "Daily generation quota exceeded",
      details: {
        limit: env.MAX_GENERATIONS_PER_DAY,
        resetsAt: getBangkokMidnightIso(),
      },
    });
  }

  await db
    .insert(schema.usageCounters)
    .values({
      userId,
      day: today,
      generations: 1,
      chatMessages: 0,
    })
    .onConflictDoUpdate({
      target: [schema.usageCounters.userId, schema.usageCounters.day],
      set: {
        generations: sql`${schema.usageCounters.generations} + 1`,
      },
    });
}

export async function checkAndIncrementChatQuota(userId: string): Promise<void> {
  const db = getDb();
  const today = getBangkokDateString();

  const [counter] = await db
    .select()
    .from(schema.usageCounters)
    .where(and(eq(schema.usageCounters.userId, userId), eq(schema.usageCounters.day, today)));

  if (counter && counter.chatMessages >= env.MAX_CHAT_MESSAGES_PER_DAY) {
    throw new AppError("QUOTA_EXCEEDED", {
      message: "Daily chat quota exceeded",
      details: {
        limit: env.MAX_CHAT_MESSAGES_PER_DAY,
        resetsAt: getBangkokMidnightIso(),
      },
    });
  }

  await db
    .insert(schema.usageCounters)
    .values({
      userId,
      day: today,
      generations: 0,
      chatMessages: 1,
    })
    .onConflictDoUpdate({
      target: [schema.usageCounters.userId, schema.usageCounters.day],
      set: {
        chatMessages: sql`${schema.usageCounters.chatMessages} + 1`,
      },
    });
}
