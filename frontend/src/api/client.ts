import { tokenStore } from "@/auth/tokenStore";
import i18n from "@/i18n";
import { normalizeDisplayNames } from "@/lib/displayNames";
import { generateUuid } from "@/lib/uuid";
import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import Constants from "expo-constants";
import { resolveApiBaseUrl } from "./baseUrl";
import { ApiError } from "./errors";
import type { AuthTokens } from "./types";

const expoHostUri =
  Constants.expoConfig?.hostUri ??
  (Constants as any).manifest2?.extra?.expoClient?.hostUri ??
  (Constants as any).manifest?.debuggerHost;

export const API_BASE_URL = resolveApiBaseUrl(
  process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:3000",
  { isDevelopment: __DEV__, expoHostUri },
);

/**
 * Absolute URL of a source file. The endpoint requires the access token, so
 * it has to be paired with {@link authHeaders} (contract 3.5).
 */
export function sourceFileUrl(sourceId: string, index: number): string {
  return `${API_BASE_URL}/v1/sources/${sourceId}/files/${index}`;
}

/** Headers for endpoints that are loaded outside of the Axios client. */
export function authHeaders(): Record<string, string> {
  const token = tokenStore.getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

let onUnauthenticatedHandler: (() => void) | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setOnUnauthenticated(handler: () => void) {
  onUnauthenticatedHandler = handler;
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/v1`,
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.getAccessToken();
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const currentLang = i18n.language === "en" ? "en" : "th";
  config.headers["Accept-Language"] = currentLang;

  if (!config.headers["X-Request-Id"]) {
    config.headers["X-Request-Id"] = generateUuid();
  }

  return config;
});

async function refreshAuthTokens(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const refreshToken = await tokenStore.getRefreshToken();
      if (!refreshToken) {
        throw new Error("No refresh token");
      }

      const response = await axios.post<{ tokens: AuthTokens }>(
        `${API_BASE_URL}/v1/auth/refresh`,
        { refreshToken },
        { timeout: 15000 },
      );

      const tokens = response.data.tokens;
      tokenStore.setAccessToken(tokens.accessToken, tokens.accessTokenExpiresAt);
      await tokenStore.setRefreshToken(tokens.refreshToken);
      return tokens.accessToken;
    } catch (err: any) {
      await tokenStore.clearTokens();
      if (onUnauthenticatedHandler) {
        onUnauthenticatedHandler();
      }
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

apiClient.interceptors.response.use(
  (response) => {
    response.data = normalizeDisplayNames(response.data);
    return response;
  },
  async (error: AxiosError<any>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Network error
    if (!error.response) {
      if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
        return Promise.reject(ApiError.timeoutError());
      }
      return Promise.reject(ApiError.networkError());
    }

    const status = error.response.status;
    const data = error.response.data;

    // Handle 401 token refresh (TOKEN_EXPIRED)
    if (status === 401 && !originalRequest._retry && data?.error?.code === "TOKEN_EXPIRED") {
      originalRequest._retry = true;
      const newAccessToken = await refreshAuthTokens();
      if (newAccessToken) {
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      }
    }

    if (
      status === 401 &&
      (data?.error?.code === "REFRESH_TOKEN_INVALID" ||
        data?.error?.code === "REFRESH_TOKEN_REUSED" ||
        data?.error?.code === "UNAUTHENTICATED")
    ) {
      await tokenStore.clearTokens();
      if (onUnauthenticatedHandler) {
        onUnauthenticatedHandler();
      }
    }

    if (data?.error?.code) {
      return Promise.reject(ApiError.fromErrorBody(data.error, status));
    }

    return Promise.reject(
      new ApiError({
        status,
        code: "INTERNAL_ERROR",
        message: data?.message || error.message || "Unknown error",
        retryable: status >= 500,
      }),
    );
  },
);
