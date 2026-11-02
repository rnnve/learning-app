import { Elysia } from "elysia";
import { AppError } from "../lib/errors.ts";
import { logger } from "../lib/logger.ts";

export const errorsPlugin = new Elysia({ name: "errors-handler" }).onError(
  { as: "global" },
  ({ code, error, set, request }) => {
    const lang = request.headers.get("accept-language")?.startsWith("en") ? "en" : "th";
    const requestId = request.headers.get("x-request-id") || undefined;

    if (error instanceof AppError) {
      set.status = error.httpStatus;
      return error.toResponse(lang, requestId);
    }

    if (code === "VALIDATION") {
      set.status = 422;
      const validationErr = new AppError("VALIDATION_ERROR", {
        details: { fields: (error as any)?.all || [(error as any)?.message] },
      });
      return validationErr.toResponse(lang, requestId);
    }

    if (code === "NOT_FOUND") {
      set.status = 404;
      const notFoundErr = new AppError("NOT_FOUND", {
        message: lang === "en" ? "Route not found" : "ไม่พบเส้นทางที่เรียกใช้งาน",
      });
      return notFoundErr.toResponse(lang, requestId);
    }

    logger.error("Unhandled error in request", {
      code,
      message: (error as any)?.message,
      stack: (error as any)?.stack,
    });

    set.status = 500;
    const internalErr = new AppError("INTERNAL_ERROR");
    return internalErr.toResponse(lang, requestId);
  },
);
