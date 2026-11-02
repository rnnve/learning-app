import i18n from "@/i18n";
import type { ErrorBody } from "./types";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;
  readonly requestId?: string;
  readonly details?: Record<string, unknown> | null;

  constructor(params: {
    status: number;
    code: string;
    message: string;
    retryable: boolean;
    requestId?: string;
    details?: Record<string, unknown> | null;
  }) {
    super(params.message);
    this.name = "ApiError";
    this.status = params.status;
    this.code = params.code;
    this.retryable = params.retryable;
    this.requestId = params.requestId;
    this.details = params.details;
  }

  static fromErrorBody(errorBody: ErrorBody, status = 400): ApiError {
    return new ApiError({
      status,
      code: errorBody.code,
      message: errorBody.message,
      retryable: errorBody.retryable,
      requestId: errorBody.requestId,
      details: errorBody.details,
    });
  }

  static networkError(): ApiError {
    return new ApiError({
      status: 0,
      code: "NETWORK_ERROR",
      message: "Network request failed",
      retryable: true,
    });
  }

  static timeoutError(): ApiError {
    return new ApiError({
      status: 408,
      code: "CLIENT_TIMEOUT",
      message: "Client request timed out",
      retryable: true,
    });
  }

  getLocalizedMessage(): string {
    const key = `errors.${this.code}`;
    const exists = i18n.exists(key);
    if (exists) {
      return i18n.t(key);
    }
    return this.message || i18n.t("errors.GENERIC_FALLBACK");
  }
}

/**
 * Localize the error of a background job (contract 3.2: `Job.error` and
 * `Source.error` use the same shape as the error body).
 */
export function localizeErrorBody(errorBody: ErrorBody | null | undefined): string {
  if (!errorBody) return i18n.t("errors.GENERIC_FALLBACK");
  const key = `errors.${errorBody.code}`;
  if (i18n.exists(key)) {
    return i18n.t(key);
  }
  return errorBody.message || i18n.t("errors.GENERIC_FALLBACK");
}

/**
 * Localize any error for the UI (contract 3.2 + i18n rules).
 *
 * - `ApiError`  -> the message of the `errors.<code>` namespace, the raw
 *                  server message is only used for an unmapped code.
 * - `Error`     -> its message (e.g. a local validation error).
 * - `string`    -> an i18n key (`errors.X`) is translated, any other string
 *                  is treated as an already localized message.
 * - anything else -> the generic fallback.
 */
export function localizeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.getLocalizedMessage();
  }
  if (error instanceof Error) {
    return error.message || i18n.t("errors.GENERIC_FALLBACK");
  }
  if (typeof error === "string" && error.length > 0) {
    if (i18n.exists(error)) {
      return i18n.t(error);
    }
    // An arbitrary string that is not an i18n key falls back to the generic
    // message (contract: never show raw server message unless the code is unmapped).
    return i18n.t("errors.GENERIC_FALLBACK");
  }
  return i18n.t("errors.GENERIC_FALLBACK");
}
