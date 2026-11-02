import { setOnUnauthenticated } from "@/api/client";
import {
  createGuestSession,
  loginAccount,
  logoutAccount,
  refreshTokens,
  registerAccount,
} from "@/api/endpoints/auth";
import { updateConsent as apiUpdateConsent, getMe, updateMe } from "@/api/endpoints/me";
import type { Preferences, User } from "@/api/types";
import i18n from "@/i18n";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type React from "react";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { tokenStore } from "./tokenStore";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isGuest: boolean;
  hasConsent: boolean;
  startGuestSession: () => Promise<User>;
  signIn: (params: { email: string; password: string }) => Promise<User>;
  register: (params: { email: string; password: string; displayName?: string }) => Promise<User>;
  signOut: () => Promise<void>;
  acceptConsent: (version: string) => Promise<User>;
  updateUserPreferences: (prefs: Partial<Preferences>) => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const initAuth = useCallback(async () => {
    try {
      // Load saved language if any
      const savedLang = await AsyncStorage.getItem("app_ui_language");
      if (savedLang === "en" || savedLang === "th") {
        await i18n.changeLanguage(savedLang);
      }

      const refreshToken = await tokenStore.getRefreshToken();
      if (!refreshToken) {
        setIsLoading(false);
        return;
      }

      const res = await refreshTokens(refreshToken);
      tokenStore.setAccessToken(res.tokens.accessToken, res.tokens.accessTokenExpiresAt);
      await tokenStore.setRefreshToken(res.tokens.refreshToken);

      const me = await getMe();
      setUser(me);

      if (me.preferences?.uiLanguage) {
        await i18n.changeLanguage(me.preferences.uiLanguage);
      }
    } catch {
      await tokenStore.clearTokens();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setOnUnauthenticated(() => {
      setUser(null);
    });
    initAuth();
  }, [initAuth]);

  const startGuestSession = async (): Promise<User> => {
    const res = await createGuestSession();
    tokenStore.setAccessToken(res.tokens.accessToken, res.tokens.accessTokenExpiresAt);
    await tokenStore.setRefreshToken(res.tokens.refreshToken);
    setUser(res.user);
    return res.user;
  };

  const signIn = async (params: { email: string; password: string }): Promise<User> => {
    const res = await loginAccount(params);
    tokenStore.setAccessToken(res.tokens.accessToken, res.tokens.accessTokenExpiresAt);
    await tokenStore.setRefreshToken(res.tokens.refreshToken);
    setUser(res.user);
    if (res.user.preferences?.uiLanguage) {
      await i18n.changeLanguage(res.user.preferences.uiLanguage);
    }
    return res.user;
  };

  const register = async (params: {
    email: string;
    password: string;
    displayName?: string;
  }): Promise<User> => {
    const res = await registerAccount(params);
    tokenStore.setAccessToken(res.tokens.accessToken, res.tokens.accessTokenExpiresAt);
    await tokenStore.setRefreshToken(res.tokens.refreshToken);
    setUser(res.user);
    return res.user;
  };

  const signOut = async () => {
    try {
      const refreshToken = await tokenStore.getRefreshToken();
      if (refreshToken) {
        await logoutAccount(refreshToken);
      }
    } catch {
      // Ignore
    } finally {
      await tokenStore.clearTokens();
      setUser(null);
    }
  };

  const acceptConsent = async (version: string): Promise<User> => {
    const updated = await apiUpdateConsent({
      aiProcessing: true,
      version,
    });
    setUser(updated);
    return updated;
  };

  const updateUserPreferences = async (prefs: Partial<Preferences>) => {
    if (!user) return;
    const previousUser = user;
    setUser((prev) => (prev ? { ...prev, preferences: { ...prev.preferences, ...prefs } } : null));
    try {
      const updated = await updateMe({ preferences: prefs });
      setUser(updated);
      if (prefs.uiLanguage) {
        await i18n.changeLanguage(prefs.uiLanguage);
        await AsyncStorage.setItem("app_ui_language", prefs.uiLanguage);
      }
    } catch (error) {
      setUser(previousUser);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: Boolean(user),
        isGuest: Boolean(user?.isGuest),
        hasConsent: Boolean(user?.consent?.aiProcessing),
        startGuestSession,
        signIn,
        register,
        signOut,
        acceptConsent,
        updateUserPreferences,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
