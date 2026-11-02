import { Elysia } from "elysia";

export const securityHeadersPlugin = new Elysia({ name: "security-headers" }).onAfterHandle(
  { as: "global" },
  ({ set }) => {
    set.headers["X-Content-Type-Options"] = "nosniff";
    set.headers["Referrer-Policy"] = "no-referrer";
    set.headers["X-Frame-Options"] = "DENY";
    set.headers["X-XSS-Protection"] = "1; mode=block";
  },
);
