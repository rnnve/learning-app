import { Elysia, t } from "elysia";
import { AppError } from "../lib/errors.ts";
import { authPlugin } from "../plugins/auth.ts";
import { conversationService } from "../services/conversations.ts";
import { idempotencyService } from "../services/idempotency.ts";

export const conversationRoutes = new Elysia({ prefix: "/v1/conversations" })
  .use(authPlugin)
  .post(
    "",
    async ({ user, body, set }) => {
      const conv = await conversationService.createConversation(user.id, body.title, body.sourceId);
      set.status = 201;
      return {
        id: conv.id,
        title: conv.title,
        sourceId: conv.sourceId,
        lastMessagePreview: null,
        createdAt: conv.createdAt.toISOString(),
        updatedAt: conv.updatedAt.toISOString(),
      };
    },
    {
      body: t.Object({
        title: t.Optional(t.String({ maxLength: 120 })),
        sourceId: t.Optional(t.Union([t.String(), t.Null()])),
      }),
      detail: {
        tags: ["Chat"],
        summary: "Create a new conversation",
      },
    },
  )
  .get(
    "",
    async ({ user, query }) => {
      return await conversationService.listConversations({
        userId: user.id,
        sourceId: query.sourceId,
        limit: query.limit ? Number.parseInt(query.limit, 10) : undefined,
        cursor: query.cursor,
      });
    },
    {
      query: t.Object({
        sourceId: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        cursor: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Chat"],
        summary: "List user conversations",
      },
    },
  )
  .get(
    "/:id",
    async ({ user, params }) => {
      const conv = await conversationService.getConversation(user.id, params.id);
      return {
        id: conv.id,
        title: conv.title,
        sourceId: conv.sourceId,
        lastMessagePreview: null,
        createdAt: conv.createdAt.toISOString(),
        updatedAt: conv.updatedAt.toISOString(),
      };
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        tags: ["Chat"],
        summary: "Get conversation details by ID",
      },
    },
  )
  .patch(
    "/:id",
    async ({ user, params, body }) => {
      const updated = await conversationService.updateConversation(user.id, params.id, body.title);
      return {
        id: updated.id,
        title: updated.title,
        sourceId: updated.sourceId,
        lastMessagePreview: null,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        title: t.String({ minLength: 1, maxLength: 120 }),
      }),
      detail: {
        tags: ["Chat"],
        summary: "Update conversation title",
      },
    },
  )
  .delete(
    "/:id",
    async ({ user, params, set }) => {
      await conversationService.deleteConversation(user.id, params.id);
      set.status = 204;
      return null;
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        tags: ["Chat"],
        summary: "Delete conversation and messages",
      },
    },
  )
  .get(
    "/:id/messages",
    async ({ user, params, query }) => {
      return await conversationService.listMessages({
        userId: user.id,
        conversationId: params.id,
        limit: query.limit ? Number.parseInt(query.limit, 10) : undefined,
        cursor: query.cursor,
      });
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({
        limit: t.Optional(t.String()),
        cursor: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Chat"],
        summary: "List messages in conversation (newest first)",
      },
    },
  )
  .post(
    "/:id/messages",
    async ({ user, params, body, request, set }) => {
      const idempotencyKey = request.headers.get("idempotency-key");
      if (!idempotencyKey) {
        throw new AppError("VALIDATION_ERROR", { message: "Idempotency-Key header is required" });
      }

      const idemp = await idempotencyService.begin(
        user.id,
        idempotencyKey,
        "POST",
        `/v1/conversations/${params.id}/messages`,
        body,
      );

      if (idemp.isReplay) {
        set.status = idemp.statusCode || 201;
        return idemp.responseBody;
      }

      try {
        const result = await conversationService.sendMessage({
          userId: user.id,
          conversationId: params.id,
          content: body.content,
          clientMessageId: body.clientMessageId,
          language: body.language,
          level: body.level,
        });

        await idempotencyService.complete(user.id, idempotencyKey, 201, result);

        set.status = 201;
        return result;
      } catch (err) {
        await idempotencyService.release(user.id, idempotencyKey);
        throw err;
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        content: t.String({ minLength: 1, maxLength: 4000 }),
        clientMessageId: t.String(),
        language: t.Optional(t.Union([t.Literal("auto"), t.Literal("th"), t.Literal("en")])),
        level: t.Optional(
          t.Union([
            t.Literal("primary"),
            t.Literal("lower_secondary"),
            t.Literal("upper_secondary"),
            t.Literal("university"),
            t.Literal("general"),
            t.Literal("auto"),
          ]),
        ),
      }),
      detail: {
        tags: ["Chat"],
        summary: "Send message to study tutor and get synchronous answer",
      },
    },
  );
