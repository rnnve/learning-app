import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { getDb, schema } from "../db/client.ts";
import { AppError } from "../lib/errors.ts";
import { authService, formatUserResponse } from "../services/auth.ts";

export const authPlugin = new Elysia({ name: "auth" }).derive(
  { as: "scoped" },
  async ({ request }) => {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError("UNAUTHENTICATED", { message: "Missing or invalid Authorization header" });
    }

    const token = authHeader.substring(7).trim();
    const payload = await authService.verifyAccessToken(token);

    const db = getDb();
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, payload.sub));

    if (!user) {
      throw new AppError("UNAUTHENTICATED", { message: "User account not found" });
    }

    return {
      user: formatUserResponse(user),
      rawUser: user,
    };
  },
);
