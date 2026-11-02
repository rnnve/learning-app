import { and, asc, desc, eq, lt } from "drizzle-orm";
import { resolveSourceRefs } from "../ai/pipeline/postprocess.ts";
import { SYSTEM_PROMPT_V1 } from "../ai/prompts/system.v1.ts";
import { buildChatTaskPrompt } from "../ai/prompts/tasks.v1.ts";
import { getGenerationProvider } from "../ai/providers/factory.ts";
import { type ChatOutput, ChatOutputSchema } from "../ai/schemas/chat.ts";
import { getDb, schema } from "../db/client.ts";
import { AppError } from "../lib/errors.ts";
import { generateId } from "../lib/ids.ts";
import { type ChunkItem, rankChunksBM25 } from "../processing/retrieval.ts";
import { checkAndIncrementChatQuota } from "./quota.ts";

export class ConversationService {
  public async createConversation(userId: string, title?: string, sourceId?: string | null) {
    const db = getDb();

    if (sourceId) {
      const [source] = await db
        .select()
        .from(schema.sources)
        .where(and(eq(schema.sources.id, sourceId), eq(schema.sources.userId, userId)));
      if (!source) {
        throw new AppError("NOT_FOUND", { message: "Source not found" });
      }
      if (source.status !== "ready" && source.status !== "partial") {
        throw new AppError("SOURCE_NOT_READY", { message: "Source is not ready for chat" });
      }
    }

    const [conv] = await db
      .insert(schema.conversations)
      .values({
        userId,
        sourceId: sourceId || null,
        title: title?.trim() || "",
      })
      .returning();

    return conv;
  }

  public async getConversation(userId: string, id: string) {
    const db = getDb();
    const [conv] = await db
      .select()
      .from(schema.conversations)
      .where(and(eq(schema.conversations.id, id), eq(schema.conversations.userId, userId)));

    if (!conv) {
      throw new AppError("NOT_FOUND", { message: "Conversation not found" });
    }

    return conv;
  }

  public async updateConversation(userId: string, id: string, title: string) {
    const db = getDb();
    const [updated] = await db
      .update(schema.conversations)
      .set({
        title: title.trim(),
        updatedAt: new Date(),
      })
      .where(and(eq(schema.conversations.id, id), eq(schema.conversations.userId, userId)))
      .returning();

    if (!updated) {
      throw new AppError("NOT_FOUND", { message: "Conversation not found" });
    }

    return updated;
  }

  public async listConversations(params: {
    userId: string;
    sourceId?: string;
    limit?: number;
    cursor?: string;
  }) {
    const db = getDb();
    const limit = Math.min(Math.max(params.limit || 20, 1), 50);

    const conditions = [eq(schema.conversations.userId, params.userId)];
    if (params.sourceId) {
      conditions.push(eq(schema.conversations.sourceId, params.sourceId));
    }
    if (params.cursor) {
      conditions.push(lt(schema.conversations.updatedAt, new Date(params.cursor)));
    }

    const convs = await db
      .select()
      .from(schema.conversations)
      .where(and(...conditions))
      .orderBy(desc(schema.conversations.updatedAt))
      .limit(limit + 1);

    let nextCursor: string | null = null;
    if (convs.length > limit) {
      const nextItem = convs.pop()!;
      nextCursor = nextItem.updatedAt.toISOString();
    }

    // Attach lastMessagePreview
    const items = await Promise.all(
      convs.map(async (c) => {
        const [lastMsg] = await db
          .select({ content: schema.messages.content })
          .from(schema.messages)
          .where(eq(schema.messages.conversationId, c.id))
          .orderBy(desc(schema.messages.createdAt))
          .limit(1);

        return {
          id: c.id,
          title: c.title,
          sourceId: c.sourceId,
          lastMessagePreview: lastMsg?.content ? lastMsg.content.slice(0, 100) : null,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        };
      }),
    );

    return { items, nextCursor };
  }

  public async deleteConversation(userId: string, id: string) {
    const db = getDb();
    await this.getConversation(userId, id); // Verify ownership
    await db.delete(schema.conversations).where(eq(schema.conversations.id, id));
  }

  public async listMessages(params: {
    userId: string;
    conversationId: string;
    limit?: number;
    cursor?: string;
  }) {
    const { userId, conversationId } = params;
    await this.getConversation(userId, conversationId); // Verify ownership

    const db = getDb();
    const limit = Math.min(Math.max(params.limit || 20, 1), 50);
    const conditions = [eq(schema.messages.conversationId, conversationId)];

    if (params.cursor) {
      conditions.push(lt(schema.messages.createdAt, new Date(params.cursor)));
    }

    const msgs = await db
      .select()
      .from(schema.messages)
      .where(and(...conditions))
      .orderBy(desc(schema.messages.createdAt))
      .limit(limit + 1);

    let nextCursor: string | null = null;
    if (msgs.length > limit) {
      const nextItem = msgs.pop()!;
      nextCursor = nextItem.createdAt.toISOString();
    }

    const items = msgs.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      role: m.role,
      content: m.content,
      grounding: m.grounding,
      citations: m.citations,
      suggestedFollowUps: m.suggestedFollowUps,
      clientMessageId: m.clientMessageId,
      createdAt: m.createdAt.toISOString(),
    }));

    return { items, nextCursor };
  }

  public async sendMessage(params: {
    userId: string;
    conversationId: string;
    content: string;
    clientMessageId: string;
    language?: "auto" | "th" | "en";
    level?: string;
  }) {
    const { userId, conversationId, content, clientMessageId, language, level } = params;
    const db = getDb();

    // 1. Consent check
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    if (!user || !user.consentVersion) {
      throw new AppError("CONSENT_REQUIRED", { message: "AI processing consent required" });
    }

    // 2. Load conversation
    const conv = await this.getConversation(userId, conversationId);

    // 3. Quota check
    await checkAndIncrementChatQuota(userId);

    // 4. Fetch context: source chunks and conversation history
    let sourceContext = "";
    const chunksMap = new Map<string, ChunkItem>();

    if (conv.sourceId) {
      const [source] = await db
        .select()
        .from(schema.sources)
        .where(eq(schema.sources.id, conv.sourceId));

      if (source && (source.status === "ready" || source.status === "partial")) {
        const rawChunks = await db
          .select()
          .from(schema.sourceChunks)
          .where(eq(schema.sourceChunks.sourceId, conv.sourceId))
          .orderBy(schema.sourceChunks.idx);

        const allChunks: ChunkItem[] = rawChunks.map((c) => ({
          id: `c${c.idx}`,
          index: c.idx,
          page: c.page,
          text: c.text,
          charCount: c.charCount,
        }));

        for (const c of allChunks) {
          chunksMap.set(c.id, c);
        }

        const ranked = rankChunksBM25(content, allChunks, 6);
        sourceContext = [
          `<<<SOURCE title="${source.title}">>>`,
          ...ranked.map((c) => `[${c.id} p${c.page ?? 1}] ${c.text}`),
          "<<<END SOURCE>>>",
        ].join("\n\n");
      }
    }

    // Load last 12 messages
    const recentMsgs = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, conversationId))
      .orderBy(desc(schema.messages.createdAt))
      .limit(12);

    const historyAsc = recentMsgs.reverse();
    const historyText = historyAsc
      .map((m) => `${m.role === "user" ? "Student" : "Nong Tiw"}: ${m.content}`)
      .join("\n\n");

    const resolvedLang = language || "auto";
    const resolvedLevel = level || "general";

    const taskPrompt = buildChatTaskPrompt({
      language: resolvedLang,
      level: resolvedLevel,
    });

    const userPrompt = [
      sourceContext ? sourceContext : "",
      historyText ? `CONVERSATION HISTORY:\n${historyText}` : "",
      `CURRENT STUDENT MESSAGE: ${content}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const provider = getGenerationProvider();
    const abortController = new AbortController();
    const timer = setTimeout(() => abortController.abort(), 60000);

    let chatResult: ChatOutput;
    try {
      const res = await provider.generateJson<ChatOutput>(
        {
          system: `${SYSTEM_PROMPT_V1}\n\n${taskPrompt}`,
          user: userPrompt,
          schema: ChatOutputSchema,
          schemaName: "ChatOutput",
          temperature: 0.6,
        },
        { signal: abortController.signal },
      );
      chatResult = res.data;
    } finally {
      clearTimeout(timer);
    }

    // Post-process citations
    const citations = resolveSourceRefs(
      chatResult.usedChunkIds.map((cid) => ({ chunkId: cid, page: null, quote: null })),
      chunksMap,
    );

    // Persist user and assistant message in ONE transaction
    const userMsgId = generateId();
    const assistantMsgId = generateId();
    const now = new Date();

    const newTitle = conv.title || content.slice(0, 40).trim();

    await db.transaction(async (tx) => {
      await tx.insert(schema.messages).values({
        id: userMsgId,
        conversationId,
        userId,
        role: "user",
        content,
        grounding: null,
        citations: [],
        suggestedFollowUps: [],
        clientMessageId,
        createdAt: now,
      });

      await tx.insert(schema.messages).values({
        id: assistantMsgId,
        conversationId,
        userId,
        role: "assistant",
        content: chatResult.answer,
        grounding: chatResult.grounding,
        citations,
        suggestedFollowUps: chatResult.suggestedFollowUps || [],
        clientMessageId: null,
        createdAt: new Date(now.getTime() + 100),
      });

      await tx
        .update(schema.conversations)
        .set({
          title: newTitle,
          updatedAt: new Date(),
        })
        .where(eq(schema.conversations.id, conversationId));
    });

    return {
      userMessage: {
        id: userMsgId,
        conversationId,
        role: "user" as const,
        content,
        grounding: null,
        citations: [],
        suggestedFollowUps: [],
        clientMessageId,
        createdAt: now.toISOString(),
      },
      assistantMessage: {
        id: assistantMsgId,
        conversationId,
        role: "assistant" as const,
        content: chatResult.answer,
        grounding: chatResult.grounding,
        citations,
        suggestedFollowUps: chatResult.suggestedFollowUps || [],
        clientMessageId: null,
        createdAt: new Date(now.getTime() + 100).toISOString(),
      },
    };
  }
}

export const conversationService = new ConversationService();
