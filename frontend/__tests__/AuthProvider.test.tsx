/**
 * AuthProvider tests (contract Section 8): guest-first session, upgrade in
 * place, consent and sign-out.
 *
 * NOTE: @testing-library/react-native v14 exposes an async `renderHook`
 * (it returns a Promise), and `renderHook`/`render` live in RNTL - not in
 * @testing-library/react, which is not installed in this project.
 */
import { act, render, renderHook } from "@testing-library/react-native";
import type React from "react";

jest.mock("@/api/endpoints/auth", () => ({
  createGuestSession: jest.fn(),
  loginAccount: jest.fn(),
  registerAccount: jest.fn(),
  logoutAccount: jest.fn(),
  refreshTokens: jest.fn(),
}));

jest.mock("@/api/endpoints/me", () => ({
  getMe: jest.fn(),
  updateConsent: jest.fn(),
  updateMe: jest.fn(),
}));

jest.mock("@/api/client", () => ({
  setOnUnauthenticated: jest.fn(),
}));

jest.mock("@/i18n", () => ({
  changeLanguage: jest.fn().mockResolvedValue(undefined),
  t: (key: string) => key,
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/auth/tokenStore", () => ({
  tokenStore: {
    getAccessToken: jest.fn(() => null),
    getAccessTokenExpiresAt: jest.fn(() => null),
    setAccessToken: jest.fn(),
    getRefreshToken: jest.fn().mockResolvedValue(null),
    setRefreshToken: jest.fn().mockResolvedValue(undefined),
    clearTokens: jest.fn().mockResolvedValue(undefined),
  },
}));

import { AuthProvider, useAuth } from "@/auth/AuthProvider";
import { tokenStore } from "@/auth/tokenStore";

const authApi = require("@/api/endpoints/auth");
const meApi = require("@/api/endpoints/me");

const guestUser = {
  id: "guest-1",
  email: null,
  displayName: "Guest",
  isGuest: true,
  preferences: { uiLanguage: "th", contentLanguage: "auto", level: "general", theme: "system" },
  consent: { aiProcessing: false, version: null, acceptedAt: null },
  createdAt: "2026-01-01T00:00:00.000Z",
};

const registeredUser = {
  ...guestUser,
  id: "user-1",
  email: "user@test.com",
  displayName: "User",
  isGuest: false,
  consent: { aiProcessing: true, version: "v1", acceptedAt: "2026-01-01T00:00:00.000Z" },
};

const tokens = {
  accessToken: "access-1",
  refreshToken: "refresh-1",
  accessTokenExpiresAt: "2030-01-01T00:00:00.000Z",
  refreshTokenExpiresAt: "2030-01-01T00:00:00.000Z",
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

const useAuthHook = () => useAuth();

describe("AuthProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (tokenStore.getRefreshToken as jest.Mock).mockResolvedValue(null);
    authApi.createGuestSession.mockResolvedValue({ user: guestUser, tokens });
    authApi.loginAccount.mockResolvedValue({ user: registeredUser, tokens });
    authApi.registerAccount.mockResolvedValue({ user: registeredUser, tokens });
    authApi.logoutAccount.mockResolvedValue(undefined);
    authApi.refreshTokens.mockResolvedValue({ tokens });
    meApi.getMe.mockResolvedValue(registeredUser);
    meApi.updateConsent.mockResolvedValue({
      ...registeredUser,
      consent: { aiProcessing: true, version: "v1", acceptedAt: "2026-01-01T00:00:00.000Z" },
    });
  });

  it("starts unauthenticated when there is no stored refresh token", async () => {
    const { result } = await renderHook(useAuthHook, { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isGuest).toBe(false);
    expect(result.current.user).toBeNull();
    expect(authApi.refreshTokens).not.toHaveBeenCalled();
  });

  it("restores a session from a stored refresh token", async () => {
    (tokenStore.getRefreshToken as jest.Mock).mockResolvedValue("stored-refresh");

    const { result } = await renderHook(useAuthHook, { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    expect(authApi.refreshTokens).toHaveBeenCalledWith("stored-refresh");
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.email).toBe("user@test.com");
  });

  it("starts a guest session", async () => {
    const { result } = await renderHook(useAuthHook, { wrapper });

    await act(async () => {
      await result.current.startGuestSession();
    });

    expect(result.current.isGuest).toBe(true);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.id).toBe("guest-1");
    expect(tokenStore.setAccessToken).toHaveBeenCalledWith("access-1", "2030-01-01T00:00:00.000Z");
  });

  it("signs a user in", async () => {
    const { result } = await renderHook(useAuthHook, { wrapper });

    await act(async () => {
      await result.current.signIn({ email: "user@test.com", password: "password123" });
    });

    expect(result.current.isGuest).toBe(false);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.email).toBe("user@test.com");
  });

  it("registers a new user (upgrade in place)", async () => {
    const { result } = await renderHook(useAuthHook, { wrapper });

    await act(async () => {
      await result.current.register({
        email: "new@test.com",
        password: "password123",
        displayName: "New User",
      });
    });

    expect(result.current.isGuest).toBe(false);
    expect(result.current.isAuthenticated).toBe(true);
    expect(authApi.registerAccount).toHaveBeenCalledWith({
      email: "new@test.com",
      password: "password123",
      displayName: "New User",
    });
  });

  it("accepts consent with the version from the backend", async () => {
    const { result } = await renderHook(useAuthHook, { wrapper });

    await act(async () => {
      await result.current.acceptConsent("2026-10-v1");
    });

    expect(meApi.updateConsent).toHaveBeenCalledWith({
      aiProcessing: true,
      version: "2026-10-v1",
    });
    expect(result.current.hasConsent).toBe(true);
  });

  it("signs out and clears the stored tokens", async () => {
    (tokenStore.getRefreshToken as jest.Mock).mockResolvedValue("stored-refresh");

    const { result } = await renderHook(useAuthHook, { wrapper });

    await act(async () => {
      await result.current.startGuestSession();
    });
    await act(async () => {
      await result.current.signOut();
    });

    expect(authApi.logoutAccount).toHaveBeenCalledWith("stored-refresh");
    expect(tokenStore.clearTokens).toHaveBeenCalled();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("throws a helpful error when useAuth is used outside the provider", async () => {
    const Consumer = () => {
      useAuth();
      return null;
    };

    await expect(render(<Consumer />)).rejects.toThrow(
      "useAuth must be used within an AuthProvider",
    );
  });

  it("persists theme preferences and restores them on the user", async () => {
    const updated = {
      ...registeredUser,
      preferences: { ...registeredUser.preferences, theme: "dark" },
    };
    meApi.updateMe.mockResolvedValue(updated);
    const { result } = await renderHook(useAuthHook, { wrapper });
    await act(async () => {
      await result.current.signIn({ email: "user@test.com", password: "password123" });
    });
    await act(async () => {
      await result.current.updateUserPreferences({ theme: "dark" });
    });
    expect(meApi.updateMe).toHaveBeenCalledWith({ preferences: { theme: "dark" } });
    expect(result.current.user?.preferences.theme).toBe("dark");
  });

  it("rolls back a rejected theme change", async () => {
    meApi.updateMe.mockRejectedValue(new Error("offline"));
    const { result } = await renderHook(useAuthHook, { wrapper });
    await act(async () => {
      await result.current.signIn({ email: "user@test.com", password: "password123" });
    });
    await act(async () => {
      await expect(result.current.updateUserPreferences({ theme: "dark" })).rejects.toThrow(
        "offline",
      );
    });
    expect(result.current.user?.preferences.theme).toBe(registeredUser.preferences.theme);
  });
});
