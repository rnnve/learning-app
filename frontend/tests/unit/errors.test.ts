/**
 * Error handling tests (contract Section 3.2 / 7):
 *  - every contract error shape is normalized to an ApiError
 *  - the localized message is used, the raw code is never shown
 *  - the retry policy of TanStack Query follows the contract
 */
import { ApiError } from "@/api/errors";
import { shouldRetry } from "@/api/queryClient";

const errorBody = (code: string, retryable: boolean, details?: Record<string, unknown>) => ({
  code,
  message: `backend message for ${code}`,
  retryable,
  requestId: "req-1",
  details: details ?? null,
});

describe("ApiError", () => {
  it("keeps the contract fields of an error body", () => {
    const err = ApiError.fromErrorBody(errorBody("VALIDATION_ERROR", false), 422);

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("ApiError");
    expect(err.status).toBe(422);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.retryable).toBe(false);
    expect(err.requestId).toBe("req-1");
    expect(err.details).toBeNull();
  });

  it("keeps the validation details of the backend", () => {
    const err = ApiError.fromErrorBody(
      errorBody("VALIDATION_ERROR", false, { fields: [{ field: "title" }] }),
      422,
    );

    expect(err.details).toEqual({ fields: [{ field: "title" }] });
  });

  it("creates a retryable network error", () => {
    const err = ApiError.networkError();
    expect(err.code).toBe("NETWORK_ERROR");
    expect(err.retryable).toBe(true);
    expect(err.status).toBe(0);
  });

  it("creates a retryable client timeout", () => {
    const err = ApiError.timeoutError();
    expect(err.code).toBe("CLIENT_TIMEOUT");
    expect(err.retryable).toBe(true);
    expect(err.status).toBe(408);
  });

  it("prefers the localized message over the backend message", () => {
    const err = ApiError.fromErrorBody(errorBody("CONSENT_REQUIRED", false), 403);
    const localized = err.getLocalizedMessage();

    expect(localized).not.toBe("backend message for CONSENT_REQUIRED");
    expect(localized).not.toContain("CONSENT_REQUIRED");
    expect(localized.length).toBeGreaterThan(0);
  });

  it("falls back to the backend message for an unknown code", () => {
    const err = ApiError.fromErrorBody(errorBody("SOMETHING_NEW", false), 500);
    expect(err.getLocalizedMessage()).toBe("backend message for SOMETHING_NEW");
  });
});

describe("shouldRetry (contract Section 7)", () => {
  it("retries a GET twice", () => {
    expect(shouldRetry(0, new Error("boom"))).toBe(true);
    expect(shouldRetry(1, new Error("boom"))).toBe(true);
    expect(shouldRetry(2, new Error("boom"))).toBe(false);
  });

  it("never retries a 4xx that is not 429 or 408", () => {
    for (const status of [400, 401, 403, 404, 409, 413, 415, 422]) {
      const err = ApiError.fromErrorBody(errorBody("VALIDATION_ERROR", false), status);
      expect(shouldRetry(0, err)).toBe(false);
    }
  });

  it("retries a rate limited request", () => {
    const err = ApiError.fromErrorBody(errorBody("RATE_LIMITED", true), 429);
    expect(shouldRetry(0, err)).toBe(true);
    expect(shouldRetry(2, err)).toBe(false);
  });

  it("retries a timed out request", () => {
    const err = ApiError.fromErrorBody(errorBody("CLIENT_TIMEOUT", true), 408);
    expect(shouldRetry(0, err)).toBe(true);
    expect(shouldRetry(2, err)).toBe(false);
  });

  it("retries a server error", () => {
    const err = ApiError.fromErrorBody(errorBody("INTERNAL_ERROR", true), 500);
    expect(shouldRetry(0, err)).toBe(true);
    expect(shouldRetry(2, err)).toBe(false);
  });
});
