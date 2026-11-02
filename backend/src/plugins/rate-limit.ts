import { Elysia } from "elysia";
import { env } from "../config/env.ts";
import { AppError } from "../lib/errors.ts";

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const generalLimits = new Map<string, RateLimitRecord>();
const authLimits = new Map<string, RateLimitRecord>();

export const rateLimitPlugin = new Elysia({ name: "rate-limit" }).onBeforeHandle(
  { as: "global" },
  ({ request, set }) => {
    // Determine client IP
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";

    const path = new URL(request.url).pathname;
    const isAuth = path.startsWith("/v1/auth/");
    const limit = isAuth ? env.RATE_LIMIT_AUTH_PER_MIN : env.RATE_LIMIT_GENERAL_PER_MIN;
    const store = isAuth ? authLimits : generalLimits;

    const now = Date.now();
    let record = store.get(ip);

    if (!record || now > record.resetAt) {
      record = { count: 1, resetAt: now + 60000 };
      store.set(ip, record);
      return;
    }

    record.count++;
    if (record.count > limit) {
      const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
      set.headers["Retry-After"] = retryAfterSec.toString();
      throw new AppError("RATE_LIMITED", {
        message: "Rate limit exceeded",
        details: { retryAfterSec },
      });
    }
  },
);
