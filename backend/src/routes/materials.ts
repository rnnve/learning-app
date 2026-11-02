import { Elysia, t } from "elysia";
import { AppError } from "../lib/errors.ts";
import { authPlugin } from "../plugins/auth.ts";
import { idempotencyService } from "../services/idempotency.ts";
import { materialService } from "../services/materials.ts";

export const materialRoutes = new Elysia({ prefix: "/v1/materials" })
  .use(authPlugin)
  .post(
    "",
    async ({ user, body, request, set }) => {
      const idempotencyKey = request.headers.get("idempotency-key");
      if (!idempotencyKey) {
        throw new AppError("VALIDATION_ERROR", { message: "Idempotency-Key header is required" });
      }

      const idemp = await idempotencyService.begin(
        user.id,
        idempotencyKey,
        "POST",
        "/v1/materials",
        body,
      );

      if (idemp.isReplay) {
        set.status = idemp.statusCode || 202;
        return idemp.responseBody;
      }

      try {
        const result = await materialService.createMaterial({
          userId: user.id,
          type: body.type,
          sourceId: body.sourceId,
          title: body.title,
          options: body.options || {},
        });

        const responsePayload = {
          job: {
            ...result.job,
            createdAt: result.job.createdAt.toISOString(),
            startedAt: result.job.startedAt ? result.job.startedAt.toISOString() : null,
            finishedAt: result.job.finishedAt ? result.job.finishedAt.toISOString() : null,
          },
        };

        await idempotencyService.complete(user.id, idempotencyKey, 202, responsePayload);

        set.status = 202;
        return responsePayload;
      } catch (err) {
        await idempotencyService.release(user.id, idempotencyKey);
        throw err;
      }
    },
    {
      body: t.Object({
        type: t.Union([t.Literal("summary"), t.Literal("flashcards"), t.Literal("quiz")]),
        sourceId: t.String(),
        title: t.Optional(t.String({ maxLength: 120 })),
        options: t.Optional(
          t.Object({
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
            pageRange: t.Optional(
              t.Union([
                t.Object({
                  from: t.Number(),
                  to: t.Number(),
                }),
                t.Null(),
              ]),
            ),
            length: t.Optional(
              t.Union([t.Literal("short"), t.Literal("medium"), t.Literal("detailed")]),
            ),
            count: t.Optional(t.Number({ minimum: 1, maximum: 50 })),
            difficulty: t.Optional(
              t.Union([
                t.Literal("easy"),
                t.Literal("medium"),
                t.Literal("hard"),
                t.Literal("mixed"),
              ]),
            ),
            questionTypes: t.Optional(
              t.Array(
                t.Union([
                  t.Literal("multiple_choice"),
                  t.Literal("true_false"),
                  t.Literal("short_answer"),
                ]),
              ),
            ),
          }),
        ),
      }),
      detail: {
        tags: ["Materials"],
        summary: "Request AI generation of study material",
      },
    },
  )
  .get(
    "",
    async ({ user, query }) => {
      const res = await materialService.listMaterials({
        userId: user.id,
        type: query.type,
        sourceId: query.sourceId,
        saved: query.saved !== undefined ? query.saved === "true" : undefined,
        q: query.q,
        limit: query.limit ? Number.parseInt(query.limit, 10) : undefined,
        cursor: query.cursor,
      });

      return {
        items: res.items.map((m) => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
          updatedAt: m.updatedAt.toISOString(),
        })),
        nextCursor: res.nextCursor,
      };
    },
    {
      query: t.Object({
        type: t.Optional(t.String()),
        sourceId: t.Optional(t.String()),
        saved: t.Optional(t.String()),
        q: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        cursor: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Materials"],
        summary: "List user study materials (summary view)",
      },
    },
  )
  .get(
    "/:id",
    async ({ user, params }) => {
      const material = await materialService.getMaterial(user.id, params.id);
      return {
        ...material,
        createdAt: material.createdAt.toISOString(),
        updatedAt: material.updatedAt.toISOString(),
      };
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        tags: ["Materials"],
        summary: "Get full material content by ID",
      },
    },
  )
  .patch(
    "/:id",
    async ({ user, params, body }) => {
      const updated = await materialService.updateMaterial({
        userId: user.id,
        materialId: params.id,
        title: body.title,
        isSaved: body.isSaved,
      });
      return {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        title: t.Optional(t.String({ maxLength: 120 })),
        isSaved: t.Optional(t.Boolean()),
      }),
      detail: {
        tags: ["Materials"],
        summary: "Update material title or bookmark status",
      },
    },
  )
  .delete(
    "/:id",
    async ({ user, params, set }) => {
      await materialService.deleteMaterial(user.id, params.id);
      set.status = 204;
      return null;
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        tags: ["Materials"],
        summary: "Delete study material",
      },
    },
  )
  .get(
    "/:id/flashcard-progress",
    async ({ user, params }) => {
      return await materialService.getFlashcardProgress(user.id, params.id);
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        tags: ["Materials"],
        summary: "Get spaced repetition Leitner progress for flashcard deck",
      },
    },
  );
