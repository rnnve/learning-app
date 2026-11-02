import { Elysia, t } from "elysia";
import { AppError } from "../lib/errors.ts";
import { authPlugin } from "../plugins/auth.ts";
import { idempotencyService } from "../services/idempotency.ts";
import { sourceService } from "../services/sources.ts";

export const sourceRoutes = new Elysia({ prefix: "/v1/sources" })
  .use(authPlugin)
  .post(
    "",
    async ({ user, body, request, set }) => {
      // 1. Consent check
      if (!user.consent?.aiProcessing) {
        throw new AppError("CONSENT_REQUIRED", { message: "AI consent required" });
      }

      // 2. Idempotency Key check
      const idempotencyKey = request.headers.get("idempotency-key");
      if (!idempotencyKey) {
        throw new AppError("VALIDATION_ERROR", { message: "Idempotency-Key header is required" });
      }

      const files = Array.isArray(body.files) ? body.files : [body.files].filter(Boolean);
      if (files.length === 0) {
        throw new AppError("VALIDATION_ERROR", { message: "At least one file must be uploaded" });
      }

      const fileData = await Promise.all(
        files.map(async (file: File) => ({
          filename: file.name,
          bytes: new Uint8Array(await file.arrayBuffer()),
          mime: file.type || "application/octet-stream",
        })),
      );

      // Check idempotency with file names and title
      const idempotencyBody = {
        filenames: fileData.map((f) => f.filename),
        title: body.title,
        language: body.language,
      };

      const idemp = await idempotencyService.begin(
        user.id,
        idempotencyKey,
        "POST",
        "/v1/sources",
        idempotencyBody,
      );

      if (idemp.isReplay) {
        set.status = idemp.statusCode || 202;
        return idemp.responseBody;
      }

      try {
        const result = await sourceService.createSource({
          userId: user.id,
          files: fileData,
          title: body.title,
          language: body.language as any,
        });

        const responsePayload = {
          source: {
            ...result.source,
            createdAt: result.source.createdAt.toISOString(),
            updatedAt: result.source.updatedAt.toISOString(),
          },
          job: {
            ...result.job,
            createdAt: result.job.createdAt.toISOString(),
            startedAt: result.job.startedAt ? result.job.startedAt.toISOString() : null,
            finishedAt: result.job.finishedAt ? result.job.finishedAt.toISOString() : null,
          },
        };

        await idempotencyService.complete(user.id, idempotencyKey, 202, responsePayload);

        set.status = 202;
        set.headers.Location = `/v1/sources/${result.source.id}`;
        return responsePayload;
      } catch (err) {
        await idempotencyService.release(user.id, idempotencyKey);
        throw err;
      }
    },
    {
      body: t.Object({
        files: t.Any(),
        title: t.Optional(t.String({ maxLength: 120 })),
        language: t.Optional(t.Union([t.Literal("th"), t.Literal("en")])),
      }),
      detail: {
        tags: ["Sources"],
        summary: "Upload new source documents or photos",
      },
    },
  )
  .get(
    "",
    async ({ user, query }) => {
      const res = await sourceService.listSources({
        userId: user.id,
        status: query.status,
        kind: query.kind,
        q: query.q,
        limit: query.limit ? Number.parseInt(query.limit, 10) : undefined,
        cursor: query.cursor,
      });

      return {
        items: res.items.map((s) => ({
          ...s,
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
        })),
        nextCursor: res.nextCursor,
      };
    },
    {
      query: t.Object({
        status: t.Optional(t.String()),
        kind: t.Optional(t.String()),
        q: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        cursor: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Sources"],
        summary: "List user sources",
      },
    },
  )
  .get(
    "/:id",
    async ({ user, params }) => {
      const source = await sourceService.getSource(user.id, params.id);
      return {
        ...source,
        createdAt: source.createdAt.toISOString(),
        updatedAt: source.updatedAt.toISOString(),
      };
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        tags: ["Sources"],
        summary: "Get source by ID",
      },
    },
  )
  .patch(
    "/:id",
    async ({ user, params, body }) => {
      const updated = await sourceService.updateSource(user.id, params.id, body.title);
      return {
        ...updated,
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
        tags: ["Sources"],
        summary: "Update source title",
      },
    },
  )
  .get(
    "/:id/files/:index",
    async ({ user, params, set }) => {
      const index = Number.parseInt(params.index, 10);
      if (Number.isNaN(index) || index < 0) {
        throw new AppError("VALIDATION_ERROR", { message: "Invalid file index" });
      }

      const file = await sourceService.getSourceFile(user.id, params.id, index);
      set.headers["Content-Type"] = file.mime;
      set.headers["Content-Disposition"] = "inline";
      return new Response(file.bytes as any);
    },
    {
      params: t.Object({
        id: t.String(),
        index: t.String(),
      }),
      detail: {
        tags: ["Sources"],
        summary: "Get raw or preview file for source",
      },
    },
  )
  .get(
    "/:id/text",
    async ({ user, params, query }) => {
      return await sourceService.getSourceText({
        userId: user.id,
        sourceId: params.id,
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
        tags: ["Sources"],
        summary: "Get extracted text chunks in order",
      },
    },
  )
  .post(
    "/:id/retry",
    async ({ user, params, set }) => {
      const result = await sourceService.retrySource(user.id, params.id);
      set.status = 202;
      return {
        source: {
          ...result.source,
          createdAt: result.source.createdAt.toISOString(),
          updatedAt: result.source.updatedAt.toISOString(),
        },
        job: {
          ...result.job,
          createdAt: result.job.createdAt.toISOString(),
          startedAt: result.job.startedAt ? result.job.startedAt.toISOString() : null,
          finishedAt: result.job.finishedAt ? result.job.finishedAt.toISOString() : null,
        },
      };
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        tags: ["Sources"],
        summary: "Retry failed or partial source processing",
      },
    },
  )
  .delete(
    "/:id",
    async ({ user, params, query, set }) => {
      const keepMaterials = query.keepMaterials === "true";
      await sourceService.deleteSource(user.id, params.id, keepMaterials);
      set.status = 204;
      return null;
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({
        keepMaterials: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Sources"],
        summary: "Delete source and files",
      },
    },
  );
