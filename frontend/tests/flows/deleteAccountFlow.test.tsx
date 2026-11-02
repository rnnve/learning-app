import i18n from "@/i18n";
import { lightPaperTheme } from "@/theme/paperTheme";
/**
 * Delete-all-data confirmation flow (contract Section 8).
 *
 * The user has to type "DELETE" to enable the destructive action, which calls
 * DELETE /me and wipes the local session.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { PaperProvider } from "react-native-paper";

const mockDeleteMe = jest.fn();
const mockGetMe = jest.fn();
const mockUpdateMe = jest.fn();
const mockSignOut = jest.fn();
const mockReplace = jest.fn();
const mockClearCache = jest.fn();
const mockCancelQueries = jest.fn().mockResolvedValue(undefined);
let mockIsGuest = false;

jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ clear: mockClearCache, cancelQueries: mockCancelQueries }),
}));

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
  useRouter: () => ({
    back: jest.fn(),
    push: jest.fn(),
    replace: (...args: unknown[]) => mockReplace(...args),
  }),
  useLocalSearchParams: () => ({}),
}));

jest.mock("@/auth/AuthProvider", () => ({
  useAuth: () => ({
    user: {
      id: "user-1",
      email: "test@example.com",
      displayName: "Test User",
      isGuest: mockIsGuest,
      preferences: { uiLanguage: "th", contentLanguage: "auto", level: "general", theme: "system" },
      consent: {
        aiProcessing: true,
        version: "2026-10-v1",
        acceptedAt: "2026-01-01T00:00:00.000Z",
      },
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    updateUserPreferences: jest.fn().mockResolvedValue(undefined),
    isGuest: mockIsGuest,
    signOut: (...args: unknown[]) => mockSignOut(...args),
    signIn: jest.fn(),
    register: jest.fn(),
  }),
}));

jest.mock("@/api/endpoints/me", () => ({
  getMe: (...args: unknown[]) => mockGetMe(...args),
  updateMe: (...args: unknown[]) => mockUpdateMe(...args),
  deleteMe: (...args: unknown[]) => mockDeleteMe(...args),
}));

const SettingsScreen = require("../../app/(tabs)/settings").default;

function renderScreen() {
  return render(
    <PaperProvider theme={lightPaperTheme}>
      <SettingsScreen />
    </PaperProvider>,
  );
}

describe("delete-all-data confirmation flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsGuest = false;
    mockGetMe.mockResolvedValue({ apiVersion: "1.0.0" });
    mockDeleteMe.mockResolvedValue(undefined);
    mockSignOut.mockResolvedValue(undefined);
  });

  it.each([false, true])(
    "logs out and clears cached data (guest=%s)",
    async (isGuest) => {
      mockIsGuest = isGuest;
      await renderScreen();
      await fireEvent.press(screen.getByRole("button", { name: i18n.t("settings.signOut") }));
      await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/auth/sign-in"));
      expect(mockCancelQueries).toHaveBeenCalledTimes(1);
      expect(mockSignOut).toHaveBeenCalledTimes(1);
      expect(mockClearCache).toHaveBeenCalledTimes(1);
    },
    15000,
  );

  it("requires typing DELETE before the destructive action is enabled", async () => {
    const view = await renderScreen();
    await waitFor(() =>
      expect(screen.getAllByText(i18n.t("settings.deleteAllData")).length).toBeGreaterThan(0),
    );

    fireEvent.press(screen.getByText(i18n.t("settings.deleteAllData")));

    await waitFor(() => {
      expect(screen.getByTestId("confirm-dialog-input")).toBeTruthy();
    });

    expect(screen.getByTestId("confirm-dialog-confirm").props.accessibilityState).toMatchObject({
      disabled: true,
    });

    await fireEvent.changeText(screen.getByTestId("confirm-dialog-input"), "DELET");
    expect(screen.getByTestId("confirm-dialog-confirm").props.accessibilityState).toMatchObject({
      disabled: true,
    });

    await fireEvent.changeText(screen.getByTestId("confirm-dialog-input"), "DELETE");
    expect(screen.getByTestId("confirm-dialog-confirm").props.accessibilityState).toMatchObject({
      disabled: false,
    });
  });

  it("deletes the account, signs out and goes back to sign-in", async () => {
    await renderScreen();
    await waitFor(() =>
      expect(screen.getAllByText(i18n.t("settings.deleteAllData")).length).toBeGreaterThan(0),
    );

    fireEvent.press(screen.getByText(i18n.t("settings.deleteAllData")));

    await waitFor(() => {
      expect(screen.getByTestId("confirm-dialog-input")).toBeTruthy();
    });

    await fireEvent.changeText(screen.getByTestId("confirm-dialog-input"), "DELETE");
    await fireEvent.press(screen.getByTestId("confirm-dialog-confirm"));

    await waitFor(() => {
      expect(mockDeleteMe).toHaveBeenCalledTimes(1);
    });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/auth/sign-in");
  });

  it("lets the user cancel the deletion", async () => {
    await renderScreen();
    await waitFor(() =>
      expect(screen.getAllByText(i18n.t("settings.deleteAllData")).length).toBeGreaterThan(0),
    );

    fireEvent.press(screen.getByText(i18n.t("settings.deleteAllData")));

    await waitFor(() => {
      expect(screen.getByTestId("confirm-dialog-cancel")).toBeTruthy();
    });

    await fireEvent.press(screen.getByTestId("confirm-dialog-cancel"));

    expect(mockDeleteMe).not.toHaveBeenCalled();
  });
});
