import { render, waitFor } from "@testing-library/react-native";
import React from "react";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("expo-router", () => {
  const { View } = require("react-native");
  const Screen = () => null;
  return {
    Stack: Object.assign(({ children }: any) => <View>{children}</View>, { Screen }),
    Tabs: Object.assign(({ children }: any) => <View>{children}</View>, { Screen }),
    ThemeProvider: ({ children }: any) => <View>{children}</View>,
    DarkTheme: { colors: {}, dark: true },
    DefaultTheme: { colors: {}, dark: false },
    useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
    useLocalSearchParams: () => ({}),
  };
});

jest.mock("@expo-google-fonts/noto-sans-thai", () => ({
  useFonts: () => [true, null],
  NotoSansThai_400Regular: {},
  NotoSansThai_500Medium: {},
  NotoSansThai_600SemiBold: {},
  NotoSansThai_700Bold: {},
}));

jest.mock("@/api/endpoints/auth", () => ({
  createGuestSession: jest.fn(),
  loginAccount: jest.fn(),
  logoutAccount: jest.fn(),
  refreshTokens: jest.fn(),
  registerAccount: jest.fn(),
}));

jest.mock("@/api/endpoints/me", () => ({
  getMe: jest.fn(),
  updateConsent: jest.fn(),
}));

const RootLayout = require("../app/_layout").default;

describe("RootLayout", () => {
  it("renders the app inside an AuthProvider", async () => {
    const errors: unknown[] = [];
    const origError = console.error;
    console.error = (...args: any[]) => {
      errors.push(args);
    };

    let tree: any;
    try {
      tree = await render(<RootLayout />);
      await waitFor(() => {
        expect(tree.root).toBeTruthy();
      });
    } finally {
      console.error = origError;
    }

    // The layout itself consumes useAuth(), so rendering without a provider
    // would throw "useAuth must be used within an AuthProvider".
    expect(JSON.stringify(errors)).not.toContain("useAuth must be used within an AuthProvider");
  });
});
