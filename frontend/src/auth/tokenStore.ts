import * as SecureStore from "expo-secure-store";

const REFRESH_TOKEN_KEY = "thai_study_refresh_token";

let inMemoryAccessToken: string | null = null;
let inMemoryAccessTokenExpiresAt: string | null = null;

export const tokenStore = {
  getAccessToken: (): string | null => {
    return inMemoryAccessToken;
  },

  getAccessTokenExpiresAt: (): string | null => {
    return inMemoryAccessTokenExpiresAt;
  },

  setAccessToken: (token: string | null, expiresAt: string | null = null) => {
    inMemoryAccessToken = token;
    inMemoryAccessTokenExpiresAt = expiresAt;
  },

  getRefreshToken: async (): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  },

  setRefreshToken: async (token: string | null) => {
    try {
      if (token) {
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
      } else {
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      }
    } catch {
      // Ignore secure store errors on unsupported platforms
    }
  },

  clearTokens: async () => {
    inMemoryAccessToken = null;
    inMemoryAccessTokenExpiresAt = null;
    try {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    } catch {
      // Ignore
    }
  },
};
