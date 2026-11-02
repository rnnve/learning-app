import { Elysia, t } from "elysia";
import { authService } from "../services/auth.ts";

export const authRoutes = new Elysia({ prefix: "/v1/auth" })
  .post(
    "/guest",
    async ({ request, set }) => {
      const userAgent = request.headers.get("user-agent") || undefined;
      const res = await authService.createGuest(userAgent);
      set.status = 201;
      return res;
    },
    {
      body: t.Object({}),
      detail: {
        tags: ["Auth"],
        summary: "Create anonymous guest account",
      },
    },
  )
  .post(
    "/register",
    async ({ body, request, set }) => {
      const userAgent = request.headers.get("user-agent") || undefined;
      const authHeader = request.headers.get("authorization");
      let guestUserId: string | undefined;

      if (authHeader?.startsWith("Bearer ")) {
        try {
          const payload = await authService.verifyAccessToken(authHeader.substring(7).trim());
          guestUserId = payload.sub;
        } catch {
          // Ignore invalid token and register as new
        }
      }

      const res = await authService.register({
        email: body.email,
        password: body.password,
        displayName: body.displayName,
        guestUserId,
        userAgent,
      });

      set.status = 201;
      return res;
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        password: t.String({ minLength: 8, maxLength: 128 }),
        displayName: t.Optional(t.String({ maxLength: 60 })),
      }),
      detail: {
        tags: ["Auth"],
        summary: "Register new account or upgrade guest in place",
      },
    },
  )
  .post(
    "/login",
    async ({ body, request }) => {
      const userAgent = request.headers.get("user-agent") || undefined;
      return await authService.login(body.email, body.password, userAgent);
    },
    {
      body: t.Object({
        email: t.String(),
        password: t.String(),
      }),
      detail: {
        tags: ["Auth"],
        summary: "Authenticate with email and password",
      },
    },
  )
  .post(
    "/refresh",
    async ({ body, request }) => {
      const userAgent = request.headers.get("user-agent") || undefined;
      return await authService.refresh(body.refreshToken, userAgent);
    },
    {
      body: t.Object({
        refreshToken: t.String(),
      }),
      detail: {
        tags: ["Auth"],
        summary: "Rotate and refresh authentication tokens",
      },
    },
  )
  .post(
    "/logout",
    async ({ body, set }) => {
      await authService.logout(body.refreshToken);
      set.status = 204;
      return null;
    },
    {
      body: t.Object({
        refreshToken: t.String(),
      }),
      detail: {
        tags: ["Auth"],
        summary: "Revoke refresh token and log out",
      },
    },
  );
