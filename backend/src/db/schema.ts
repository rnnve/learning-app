import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Users
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  isGuest: boolean("is_guest").notNull().default(false),
  displayName: text("display_name").notNull().default("นักเรียน"),
  preferences: jsonb("preferences").notNull().default({
    uiLanguage: "th",
    contentLanguage: "auto",
    level: "general",
    theme: "system",
  }),
  consentVersion: text("consent_version"),
  consentAt: timestamp("consent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Refresh Tokens
export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  familyId: uuid("family_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  replacedBy: text("replaced_by"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Sources
export const sources = pgTable(
  "sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    kind: text("kind").notNull(), // "images" | "txt" | "pdf" | "docx"
    originalFilenames: text("original_filenames").array().notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    pageCount: integer("page_count").notNull(),
    fileCount: integer("file_count").notNull(),
    language: text("language").notNull().default("unknown"), // "th" | "en" | "mixed" | "unknown"
    charCount: integer("char_count").notNull().default(0),
    status: text("status").notNull().default("queued"), // "queued" | "processing" | "ready" | "partial" | "failed"
    extraction: jsonb("extraction").notNull().default({
      method: null,
      quality: null,
      pagesTotal: 0,
      pagesExtracted: 0,
      pagesFailed: [],
      warnings: [],
    }),
    error: jsonb("error"),
    contentHash: text("content_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("sources_user_id_created_at_idx").on(table.userId, table.createdAt.desc())],
);

// Source Files
export const sourceFiles = pgTable("source_files", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceId: uuid("source_id")
    .notNull()
    .references(() => sources.id, { onDelete: "cascade" }),
  idx: integer("idx").notNull(),
  storageKey: text("storage_key").notNull(),
  mime: text("mime").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
});

// Source Chunks
export const sourceChunks = pgTable(
  "source_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    idx: integer("idx").notNull(),
    page: integer("page"),
    text: text("text").notNull(),
    charCount: integer("char_count").notNull(),
  },
  (table) => [uniqueIndex("source_chunks_source_idx_unique").on(table.sourceId, table.idx)],
);

// Jobs
export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // "source_processing" | "generate_summary" | "generate_flashcards" | "generate_quiz"
    status: text("status").notNull().default("queued"), // "queued" | "running" | "succeeded" | "failed" | "canceled"
    stage: text("stage"),
    progress: integer("progress").notNull().default(0),
    detail: jsonb("detail"),
    attempt: integer("attempt").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    error: jsonb("error"),
    result: jsonb("result"),
    payload: jsonb("payload"),
    dedupeKey: text("dedupe_key"),
    runAfter: timestamp("run_after", { withTimezone: true }).defaultNow().notNull(),
    lockedBy: text("locked_by"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [
    index("jobs_status_run_after_idx").on(table.status, table.runAfter),
    index("jobs_user_id_created_at_idx").on(table.userId, table.createdAt),
  ],
);

// Materials
export const materials = pgTable(
  "materials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id").references(() => sources.id, { onDelete: "set null" }),
    type: text("type").notNull(), // "summary" | "flashcards" | "quiz"
    title: text("title").notNull(),
    content: jsonb("content").notNull(),
    options: jsonb("options").notNull().default({}),
    isSaved: boolean("is_saved").notNull().default(false),
    generatedBy: jsonb("generated_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("materials_user_id_created_at_idx").on(table.userId, table.createdAt.desc())],
);

// Conversations
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id").references(() => sources.id, { onDelete: "cascade" }),
    title: text("title").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("conversations_user_id_updated_at_idx").on(table.userId, table.updatedAt.desc()),
  ],
);

// Messages
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // "user" | "assistant"
    content: text("content").notNull(),
    grounding: text("grounding"), // "source" | "general" | "mixed" | "insufficient_source" | null
    citations: jsonb("citations").notNull().default([]),
    suggestedFollowUps: jsonb("suggested_follow_ups").notNull().default([]),
    clientMessageId: uuid("client_message_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("messages_conversation_client_id_unique").on(
      table.conversationId,
      table.clientMessageId,
    ),
    index("messages_conversation_created_at_idx").on(table.conversationId, table.createdAt),
  ],
);

// Study Sessions
export const studySessions = pgTable("study_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  materialId: uuid("material_id")
    .notNull()
    .references(() => materials.id, { onDelete: "cascade" }),
  mode: text("mode").notNull(), // "flashcards" | "quiz"
  status: text("status").notNull().default("active"), // "active" | "completed"
  itemsTotal: integer("items_total").notNull(),
  score: numeric("score"), // 0..1
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

// Study Answers
export const studyAnswers = pgTable(
  "study_answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => studySessions.id, { onDelete: "cascade" }),
    itemId: text("item_id").notNull(),
    verdict: text("verdict"), // "correct" | "partially_correct" | "incorrect"
    rating: text("rating"), // "again" | "hard" | "good" | "easy"
    answerText: text("answer_text"),
    choiceId: text("choice_id"),
    feedback: text("feedback"),
    answeredAt: timestamp("answered_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("study_answers_session_item_unique").on(table.sessionId, table.itemId)],
);

// Card Progress (Leitner)
export const cardProgress = pgTable(
  "card_progress",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    materialId: uuid("material_id")
      .notNull()
      .references(() => materials.id, { onDelete: "cascade" }),
    cardId: text("card_id").notNull(),
    box: integer("box").notNull().default(1), // 1..5
    dueAt: timestamp("due_at", { withTimezone: true }).defaultNow().notNull(),
    lastRating: text("last_rating"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.materialId, table.cardId] })],
);

// Idempotency Keys
export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    method: text("method").notNull(),
    path: text("path").notNull(),
    requestHash: text("request_hash").notNull(),
    status: integer("status"),
    responseBody: jsonb("response_body"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.key] })],
);

// Usage Counters
export const usageCounters = pgTable(
  "usage_counters",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: date("day").notNull(), // Asia/Bangkok date string YYYY-MM-DD
    generations: integer("generations").notNull().default(0),
    chatMessages: integer("chat_messages").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.userId, table.day] })],
);
