import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { getDb, schema } from "../db/client.ts";
import { AppError } from "../lib/errors.ts";
import { authPlugin } from "../plugins/auth.ts";
import { formatUserResponse } from "../services/auth.ts";
import { storage } from "../storage/local.ts";

export const meRoutes = new Elysia({ prefix: "/v1/me" })
  .use(authPlugin)
  .get(
    "",
    ({ user }) => {
      return user;
    },
    {
      detail: {
        tags: ["User"],
        summary: "Get current user profile",
      },
    },
  )
  .patch(
    "",
    async ({ user, body }) => {
      const db = getDb();
      const currentPrefs = (user.preferences as any) || {};
      const newPrefs = body.preferences ? { ...currentPrefs, ...body.preferences } : currentPrefs;

      const [updated] = await db
        .update(schema.users)
        .set({
          displayName: body.displayName?.trim() || user.displayName,
          preferences: newPrefs,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, user.id))
        .returning();

      return formatUserResponse(updated);
    },
    {
      body: t.Object({
        displayName: t.Optional(t.String({ maxLength: 60 })),
        preferences: t.Optional(
          t.Object({
            uiLanguage: t.Optional(t.Union([t.Literal("th"), t.Literal("en")])),
            contentLanguage: t.Optional(
              t.Union([t.Literal("auto"), t.Literal("th"), t.Literal("en")]),
            ),
            level: t.Optional(
              t.Union([
                t.Literal("primary"),
                t.Literal("lower_secondary"),
                t.Literal("upper_secondary"),
                t.Literal("university"),
                t.Literal("general"),
              ]),
            ),
            theme: t.Optional(
              t.Union([t.Literal("system"), t.Literal("light"), t.Literal("dark")]),
            ),
          }),
        ),
      }),
      detail: {
        tags: ["User"],
        summary: "Update profile and preferences",
      },
    },
  )
  .put(
    "/consent",
    async ({ user, body }) => {
      if (!body.aiProcessing) {
        throw new AppError("VALIDATION_ERROR", { message: "aiProcessing must be true" });
      }

      const db = getDb();
      const [updated] = await db
        .update(schema.users)
        .set({
          consentVersion: body.version,
          consentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, user.id))
        .returning();

      return formatUserResponse(updated);
    },
    {
      body: t.Object({
        aiProcessing: t.Literal(true),
        version: t.String(),
      }),
      detail: {
        tags: ["User"],
        summary: "Record user consent for AI processing",
      },
    },
  )
  .delete(
    "",
    async ({ user, body, set }) => {
      if (body.confirm !== "DELETE") {
        throw new AppError("VALIDATION_ERROR", {
          message: 'Must provide confirm: "DELETE" to delete account',
        });
      }

      const db = getDb();
      // Hard delete user from database (cascades all related tables)
      await db.delete(schema.users).where(eq(schema.users.id, user.id));

      // Remove storage directory for user
      await storage.deletePrefix(`users/${user.id}`);

      set.status = 204;
      return null;
    },
    {
      body: t.Object({
        confirm: t.Literal("DELETE"),
      }),
      detail: {
        tags: ["User"],
        summary: "Hard delete user account and all data",
      },
    },
  );
