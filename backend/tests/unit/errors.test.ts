import { describe, expect, it } from "bun:test";
import { AppError } from "../../src/lib/errors.ts";

describe("Error Formatting & Localization", () => {
  it("formats localized Thai error by default", () => {
    const err = new AppError("CONSENT_REQUIRED");
    const res = err.toResponse("th", "test-req-id");
    expect(res.error.code).toBe("CONSENT_REQUIRED");
    expect(res.error.retryable).toBe(false);
    expect(res.error.requestId).toBe("test-req-id");
    expect(res.error.message).toContain("ยินยอม");
  });

  it("formats localized English error when requested", () => {
    const err = new AppError("FILE_TOO_LARGE");
    const res = err.toResponse("en", "test-req-id");
    expect(res.error.code).toBe("FILE_TOO_LARGE");
    expect(res.error.message).toBe("File size exceeds maximum limit");
  });
});
