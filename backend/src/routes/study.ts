import { Elysia, t } from "elysia";
import { authPlugin } from "../plugins/auth.ts";
import { studyService } from "../services/study.ts";

export const studyRoutes = new Elysia({ prefix: "/v1/study-sessions" })
  .use(authPlugin)
  .post(
    "",
    async ({ user, body, set }) => {
      const session = await studyService.createSession(user.id, body.materialId, body.mode);
      set.status = 201;
      return session;
    },
    {
      body: t.Object({
        materialId: t.String(),
        mode: t.Union([t.Literal("flashcards"), t.Literal("quiz")]),
      }),
      detail: {
        tags: ["Study"],
        summary: "Start a new flashcard or quiz study session",
      },
    },
  )
  .get(
    "",
    async ({ user, query }) => {
      return await studyService.listSessions({
        userId: user.id,
        materialId: query.materialId,
        limit: query.limit ? Number.parseInt(query.limit, 10) : undefined,
        cursor: query.cursor,
      });
    },
    {
      query: t.Object({
        materialId: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        cursor: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Study"],
        summary: "List user study sessions",
      },
    },
  )
  .get(
    "/:id",
    async ({ user, params }) => {
      return await studyService.getSession(user.id, params.id);
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        tags: ["Study"],
        summary: "Get study session details and answer records",
      },
    },
  )
  .post(
    "/:id/answers",
    async ({ user, params, body }) => {
      return await studyService.recordAnswer({
        userId: user.id,
        sessionId: params.id,
        itemId: body.itemId,
        rating: body.rating as any,
        choiceId: body.choiceId,
        text: body.text,
      });
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        itemId: t.String(),
        rating: t.Optional(
          t.Union([t.Literal("again"), t.Literal("hard"), t.Literal("good"), t.Literal("easy")]),
        ),
        choiceId: t.Optional(t.String()),
        text: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Study"],
        summary: "Submit answer for flashcard or quiz question",
      },
    },
  )
  .post(
    "/:id/complete",
    async ({ user, params }) => {
      return await studyService.completeSession(user.id, params.id);
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        tags: ["Study"],
        summary: "Complete study session and compute final score",
      },
    },
  );
