import { apiClient } from "../client";
import type { AuthResponse, AuthTokens } from "../types";

export async function createGuestSession(): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>("/auth/guest", {});
  return response.data;
}

export async function registerAccount(params: {
  email: string;
  password: string;
  displayName?: string;
}): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>("/auth/register", params);
  return response.data;
}

export async function loginAccount(params: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>("/auth/login", params);
  return response.data;
}

export async function refreshTokens(refreshToken: string): Promise<{ tokens: AuthTokens }> {
  const response = await apiClient.post<{ tokens: AuthTokens }>("/auth/refresh", {
    refreshToken,
  });
  return response.data;
}

export async function logoutAccount(refreshToken: string): Promise<void> {
  await apiClient.post("/auth/logout", { refreshToken });
}
