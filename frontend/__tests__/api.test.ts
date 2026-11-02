/**
 * API client tests (contract Section 13):
 *  - request header attachment
 *  - error normalization to ApiError (contract 3.2 shapes + network/timeout)
 *  - single-flight refresh + exactly one retry
 *  - multipart FormData construction for POST /v1/sources
 */

// The factory has to be self-contained: it is evaluated when "axios" is first
// required, which happens before the module body of this file runs.
jest.mock("axios", () => {
  const instance: any = Object.assign(jest.fn(), {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    defaults: { baseURL: "http://127.0.0.1:3000/v1", headers: {} },
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  });

  const create = jest.fn(() => instance);
  const post = jest.fn();

  return {
    __esModule: true,
    default: { create, post },
    __instance: instance,
    __create: create,
    __post: post,
  };
});

jest.mock("@/auth/tokenStore", () => ({
  tokenStore: {
    getAccessToken: jest.fn(() => "access-token-123"),
    getAccessTokenExpiresAt: jest.fn(() => null),
    setAccessToken: jest.fn(),
    getRefreshToken: jest.fn(async () => "refresh-token-123"),
    setRefreshToken: jest.fn(async () => undefined),
    clearTokens: jest.fn(async () => undefined),
  },
}));

jest.mock("@/i18n", () => ({
  __esModule: true,
  default: {
    language: "th",
    exists: jest.fn(() => true),
    t: jest.fn((key: string) => `translated:${key}`),
  },
}));

import { apiClient } from "@/api/client";
import { ApiError } from "@/api/errors";
import { tokenStore } from "@/auth/tokenStore";

const axiosModule = require("axios");
const mockInstance = axiosModule.__instance;
const mockCreate = axiosModule.__create;
const mockPost = axiosModule.__post;

// The client registers its interceptors while it is imported, so the handlers
// are captured here - before any `clearAllMocks()` in beforeEach.
const mockRequestHandler = mockInstance.interceptors.request.use.mock.calls[0][0];
const mockResponseErrorHandler = mockInstance.interceptors.response.use.mock.calls[0][1];
const mockCreateConfig = mockCreate.mock.calls[0][0];

function axiosError(status: number, body: unknown, config: any = { headers: {} }) {
  return { response: { status, data: body }, config, message: "Request failed" };
}

describe("apiClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (tokenStore.getAccessToken as jest.Mock).mockReturnValue("access-token-123");
    (tokenStore.getRefreshToken as jest.Mock).mockResolvedValue("refresh-token-123");
    mockPost.mockResolvedValue({
      data: {
        tokens: {
          accessToken: "refreshed-access",
          refreshToken: "refreshed-refresh",
          accessTokenExpiresAt: "2030-01-01T00:00:00.000Z",
        },
      },
    });
  });

  describe("configuration", () => {
    it("is created with the /v1 base path and a 20s timeout", () => {
      expect(mockCreateConfig.baseURL).toContain("/v1");
      expect(mockCreateConfig.timeout).toBe(20000);
      expect(apiClient).toBe(mockInstance);
    });
  });

  describe("request interceptor", () => {
    it("attaches the bearer token, Accept-Language and X-Request-Id", () => {
      const config = mockRequestHandler({ headers: {} });

      expect(config.headers.Authorization).toBe("Bearer access-token-123");
      expect(config.headers["Accept-Language"]).toBe("th");
      expect(config.headers["X-Request-Id"]).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    });

    it("does not overwrite an explicit Authorization header", () => {
      const config = mockRequestHandler({ headers: { Authorization: "Bearer explicit" } });
      expect(config.headers.Authorization).toBe("Bearer explicit");
    });

    it("sends Accept-Language: en when the UI language is English", () => {
      const i18n = require("@/i18n").default;
      i18n.language = "en";
      const config = mockRequestHandler({ headers: {} });
      expect(config.headers["Accept-Language"]).toBe("en");
      i18n.language = "th";
    });
  });

  describe("error normalization", () => {
    it("normalizes a contract error body into an ApiError", async () => {
      const promise = mockResponseErrorHandler(
        axiosError(422, {
          error: {
            code: "VALIDATION_ERROR",
            message: "body invalid",
            retryable: false,
            requestId: "req-1",
            details: { fields: [{ field: "title" }] },
          },
        }),
      );

      await expect(promise).rejects.toBeInstanceOf(ApiError);
      await promise.catch((err: ApiError) => {
        expect(err.status).toBe(422);
        expect(err.code).toBe("VALIDATION_ERROR");
        expect(err.retryable).toBe(false);
        expect(err.requestId).toBe("req-1");
        expect(err.details).toEqual({ fields: [{ field: "title" }] });
      });
    });

    it("normalizes a network failure into NETWORK_ERROR", async () => {
      const promise = mockResponseErrorHandler({
        response: undefined,
        config: { headers: {} },
        message: "Network Error",
      });

      await promise.catch((err: ApiError) => {
        expect(err).toBeInstanceOf(ApiError);
        expect(err.code).toBe("NETWORK_ERROR");
        expect(err.retryable).toBe(true);
      });
    });

    it("normalizes a timeout into CLIENT_TIMEOUT", async () => {
      const promise = mockResponseErrorHandler({
        response: undefined,
        config: { headers: {} },
        message: "timeout of 20000ms exceeded",
        code: "ECONNABORTED",
      });

      await promise.catch((err: ApiError) => {
        expect(err.code).toBe("CLIENT_TIMEOUT");
        expect(err.status).toBe(408);
      });
    });

    it("falls back to INTERNAL_ERROR for an unrecognised payload", async () => {
      const promise = mockResponseErrorHandler(axiosError(500, { nope: true }));

      await promise.catch((err: ApiError) => {
        expect(err.code).toBe("INTERNAL_ERROR");
        expect(err.status).toBe(500);
        expect(err.retryable).toBe(true);
      });
    });

    it("maps a localized message through the errors namespace", () => {
      const err = ApiError.fromErrorBody(
        { code: "QUOTA_EXCEEDED", message: "quota", retryable: false, requestId: "r" },
        429,
      );
      expect(err.getLocalizedMessage()).toBe("translated:errors.QUOTA_EXCEEDED");
    });
  });

  describe("token refresh", () => {
    it("refreshes once and retries the original request exactly once", async () => {
      const config: any = { headers: {} };
      const original = axiosError(
        401,
        { error: { code: "TOKEN_EXPIRED", message: "expired", retryable: true } },
        config,
      );

      await mockResponseErrorHandler(original);

      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(mockPost).toHaveBeenCalledWith(
        expect.stringContaining("/v1/auth/refresh"),
        { refreshToken: "refresh-token-123" },
        expect.anything(),
      );
      expect(tokenStore.setAccessToken).toHaveBeenCalledWith(
        "refreshed-access",
        "2030-01-01T00:00:00.000Z",
      );
      expect(config.headers.Authorization).toBe("Bearer refreshed-access");
      // The original request is replayed through the client.
      expect(mockInstance).toHaveBeenCalledTimes(1);
    });

    it("does not loop: a retried request that fails again is not refreshed twice", async () => {
      const config: any = { headers: {}, _retry: true };
      const original = axiosError(
        401,
        { error: { code: "TOKEN_EXPIRED", message: "expired", retryable: true } },
        config,
      );

      await mockResponseErrorHandler(original).catch(() => undefined);
      expect(mockPost).not.toHaveBeenCalled();
    });

    it("runs a single-flight refresh when two requests expire at once", async () => {
      const makeExpired = () =>
        axiosError(
          401,
          { error: { code: "TOKEN_EXPIRED", message: "expired", retryable: true } },
          { headers: {} },
        );

      await Promise.all([
        mockResponseErrorHandler(makeExpired()).catch(() => undefined),
        mockResponseErrorHandler(makeExpired()).catch(() => undefined),
      ]);

      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    it("clears the session when the refresh token is rejected", async () => {
      mockPost.mockRejectedValue(new Error("nope"));

      await mockResponseErrorHandler(
        axiosError(401, {
          error: { code: "TOKEN_EXPIRED", message: "expired", retryable: true },
        }),
      ).catch(() => undefined);

      expect(tokenStore.clearTokens).toHaveBeenCalled();
    });
  });

  describe("multipart upload", () => {
    it("builds FormData file parts and never sets Content-Type manually", async () => {
      const appended: Array<{ name: string; value: unknown }> = [];
      const appendSpy = jest.spyOn(FormData.prototype, "append").mockImplementation(function (
        this: FormData,
        name: string,
        value: unknown,
      ) {
        appended.push({ name, value });
      });

      const { createSource } = require("@/api/endpoints/sources");

      mockInstance.post.mockResolvedValue({
        data: { source: { id: "s1" }, job: { id: "j1" } },
      });

      await createSource({
        files: [
          { filename: "a.jpg", uri: "file:///tmp/a.jpg", mime: "image/jpeg", sizeBytes: 10 },
          { filename: "b.jpg", uri: "file:///tmp/b.jpg", mime: "image/jpeg", sizeBytes: 20 },
        ],
        title: "Notes",
        language: "th",
        idempotencyKey: "idem-1",
      });

      const [path, _formData, config] = mockInstance.post.mock.calls[0];
      expect(path).toBe("/sources");

      const files = appended.filter((p) => p.name === "files").map((p) => p.value);
      expect(files).toHaveLength(2);
      expect(files[0]).toMatchObject({
        uri: "file:///tmp/a.jpg",
        name: "a.jpg",
        type: "image/jpeg",
      });
      expect(appended.find((p) => p.name === "title")?.value).toBe("Notes");
      expect(appended.find((p) => p.name === "language")?.value).toBe("th");

      // Idempotency-Key is required (contract 3.1) and Content-Type must not be
      // set manually so the runtime can add the multipart boundary.
      expect(config.headers["Idempotency-Key"]).toBe("idem-1");
      expect(config.headers["Content-Type"]).toBeUndefined();
      expect(config.timeout).toBe(180000);

      appendSpy.mockRestore();
    });
  });

  describe("endpoint modules", () => {
    it("exposes one typed function per contract endpoint group", () => {
      const auth = require("@/api/endpoints/auth");
      const sources = require("@/api/endpoints/sources");
      const materials = require("@/api/endpoints/materials");
      const study = require("@/api/endpoints/study");
      const chat = require("@/api/endpoints/chat");
      const jobs = require("@/api/endpoints/jobs");

      expect(typeof auth.createGuestSession).toBe("function");
      expect(typeof auth.registerAccount).toBe("function");
      expect(typeof auth.loginAccount).toBe("function");
      expect(typeof auth.refreshTokens).toBe("function");
      expect(typeof auth.logoutAccount).toBe("function");

      expect(typeof sources.createSource).toBe("function");
      expect(typeof sources.getSources).toBe("function");
      expect(typeof sources.getSource).toBe("function");
      expect(typeof sources.updateSource).toBe("function");
      expect(typeof sources.getSourceText).toBe("function");
      expect(typeof sources.retrySource).toBe("function");
      expect(typeof sources.deleteSource).toBe("function");

      expect(typeof materials.createMaterial).toBe("function");
      expect(typeof materials.getMaterials).toBe("function");
      expect(typeof materials.getMaterial).toBe("function");
      expect(typeof materials.deleteMaterial).toBe("function");

      expect(typeof study.createStudySession).toBe("function");
      expect(typeof study.getStudySessions).toBe("function");
      expect(typeof study.getStudySession).toBe("function");
      expect(typeof study.submitFlashcardAnswer).toBe("function");
      expect(typeof study.submitQuizAnswer).toBe("function");
      expect(typeof study.completeStudySession).toBe("function");
      expect(typeof study.getFlashcardProgress).toBe("function");

      expect(typeof chat.createConversation).toBe("function");
      expect(typeof chat.getConversations).toBe("function");
      expect(typeof chat.getConversation).toBe("function");
      expect(typeof chat.updateConversation).toBe("function");
      expect(typeof chat.deleteConversation).toBe("function");
      expect(typeof chat.getMessages).toBe("function");
      expect(typeof chat.sendMessage).toBe("function");

      expect(typeof jobs.getJob).toBe("function");
      expect(typeof jobs.getActiveJobs).toBe("function");
      expect(typeof jobs.retryJob).toBe("function");
      expect(typeof jobs.cancelJob).toBe("function");
    });
  });
});
