import { AuthProvider } from "@/auth/AuthProvider";
import i18n from "@/i18n";
import { lightPaperTheme } from "@/theme/paperTheme";
/**
 * Onboarding flow (contract Section 8 + 9.1 + Section 13 "screen-level flows").
 *
 * welcome -> language -> guest session -> consent -> home
 *
 * The guest session has to be created before the consent can be recorded,
 * because `PUT /v1/me/consent` is an authenticated endpoint (see
 * docs/CONTRACT-NOTES.md).
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type React from "react";
import { PaperProvider } from "react-native-paper";

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockBack = jest.fn();

const mockCreateGuestSession = jest.fn();
const mockUpdateConsent = jest.fn();
const mockGetMe = jest.fn();
const mockGetMeta = jest.fn();

jest.mock("expo-router", () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
    push: (...args: unknown[]) => mockPush(...args),
    back: (...args: unknown[]) => mockBack(...args),
  },
  useRouter: () => ({
    replace: (...args: unknown[]) => mockReplace(...args),
    push: (...args: unknown[]) => mockPush(...args),
    back: (...args: unknown[]) => mockBack(...args),
  }),
  useLocalSearchParams: () => ({}),
}));

jest.mock("@/api/endpoints/auth", () => ({
  createGuestSession: (...args: unknown[]) => mockCreateGuestSession(...args),
  loginAccount: jest.fn(),
  registerAccount: jest.fn(),
  logoutAccount: jest.fn(),
  refreshTokens: jest.fn(),
}));

jest.mock("@/api/endpoints/me", () => ({
  getMe: (...args: unknown[]) => mockGetMe(...args),
  updateConsent: (...args: unknown[]) => mockUpdateConsent(...args),
}));

jest.mock("@/api/endpoints/meta", () => ({
  getMeta: (...args: unknown[]) => mockGetMeta(...args),
}));

const WelcomeScreen = require("../../app/(onboarding)/welcome").default;
const LanguageScreen = require("../../app/(onboarding)/language").default;
const ConsentScreen = require("../../app/(onboarding)/consent").default;

const guestUser = {
  id: "guest-1",
  email: null,
  displayName: "Guest",
  isGuest: true,
  preferences: { uiLanguage: "th", contentLanguage: "auto", level: "general", theme: "system" },
  consent: { aiProcessing: false, version: null, acceptedAt: null },
  createdAt: "2026-01-01T00:00:00.000Z",
};

const tokens = {
  accessToken: "access-1",
  refreshToken: "refresh-1",
  accessTokenExpiresAt: "2030-01-01T00:00:00.000Z",
  refreshTokenExpiresAt: "2030-01-01T00:00:00.000Z",
};

function withProviders(node: React.ReactElement) {
  return (
    <PaperProvider theme={lightPaperTheme}>
      <AuthProvider>{node}</AuthProvider>
    </PaperProvider>
  );
}

describe("onboarding flow", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockCreateGuestSession.mockResolvedValue({ user: guestUser, tokens });
    mockGetMeta.mockResolvedValue({
      consentVersion: "2026-10-v1",
      ai: { extraction: "live", generation: "live" },
    });
    mockUpdateConsent.mockResolvedValue({
      ...guestUser,
      consent: {
        aiProcessing: true,
        version: "2026-10-v1",
        acceptedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    await i18n.changeLanguage("th");
  });

  it("walks through the three intro slides and then to the language screen", async () => {
    await render(withProviders(<WelcomeScreen />));

    // Slide 1 shows the first step of the intro.
    expect(screen.getByText(i18n.t("onboarding.step1Title"))).toBeTruthy();

    await fireEvent.press(screen.getByTestId("intro-next"));
    expect(screen.getByText(i18n.t("onboarding.step2Title"))).toBeTruthy();

    await fireEvent.press(screen.getByTestId("intro-next"));
    expect(screen.getByText(i18n.t("onboarding.step3Title"))).toBeTruthy();

    // The last slide starts the onboarding.
    await fireEvent.press(screen.getByTestId("intro-next"));
    expect(mockReplace).toHaveBeenCalledWith("/(onboarding)/language");
  });

  it("allows skipping the intro", async () => {
    await render(withProviders(<WelcomeScreen />));

    await fireEvent.press(screen.getByTestId("intro-skip"));

    expect(mockReplace).toHaveBeenCalledWith("/(onboarding)/language");
  });

  it("creates the guest session on the language screen and continues to the consent", async () => {
    await render(withProviders(<LanguageScreen />));

    // Thai is preselected (contract 9.1).
    expect(screen.getByTestId("language-th").props.accessibilityState).toEqual({ checked: true });
    expect(screen.getByTestId("language-en").props.accessibilityState).toEqual({ checked: false });

    await fireEvent.press(screen.getByTestId("language-continue"));

    await waitFor(() => {
      expect(mockCreateGuestSession).toHaveBeenCalledTimes(1);
    });
    expect(mockReplace).toHaveBeenCalledWith("/(onboarding)/consent");
  });

  it("keeps the accept button disabled until the consent checkbox is ticked", async () => {
    await render(withProviders(<ConsentScreen />));

    await waitFor(() => {
      expect(screen.getByTestId("consent-accept")).toBeTruthy();
    });

    expect(screen.getByTestId("consent-accept").props.accessibilityState).toMatchObject({
      disabled: true,
    });

    await fireEvent.press(screen.getByTestId("consent-checkbox"));

    expect(screen.getByTestId("consent-accept").props.accessibilityState).toMatchObject({
      disabled: false,
    });
  });

  it("records the consent with the version from the backend and opens the tabs", async () => {
    await render(withProviders(<ConsentScreen />));

    await waitFor(() => {
      expect(mockGetMeta).toHaveBeenCalledTimes(1);
    });

    await fireEvent.press(screen.getByTestId("consent-checkbox"));
    await fireEvent.press(screen.getByTestId("consent-accept"));

    await waitFor(() => {
      expect(mockUpdateConsent).toHaveBeenCalledWith({
        aiProcessing: true,
        version: "2026-10-v1",
      });
    });
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/home");
  });

  it("runs the complete onboarding: welcome -> language -> consent -> home", async () => {
    const view = await render(withProviders(<WelcomeScreen />));

    // 1. welcome -> language
    await fireEvent.press(screen.getByTestId("intro-skip"));
    expect(mockReplace).toHaveBeenLastCalledWith("/(onboarding)/language");

    // 2. language -> guest session -> consent
    await view.rerender(withProviders(<LanguageScreen />));
    await fireEvent.press(screen.getByTestId("language-continue"));
    await waitFor(() => {
      expect(mockCreateGuestSession).toHaveBeenCalledTimes(1);
    });
    expect(mockReplace).toHaveBeenLastCalledWith("/(onboarding)/consent");

    // 3. consent -> home
    await view.rerender(withProviders(<ConsentScreen />));
    await waitFor(() => {
      expect(screen.getByTestId("consent-accept")).toBeTruthy();
    });
    await fireEvent.press(screen.getByTestId("consent-checkbox"));
    await fireEvent.press(screen.getByTestId("consent-accept"));
    await waitFor(() => {
      expect(mockUpdateConsent).toHaveBeenCalled();
    });
    expect(mockReplace).toHaveBeenLastCalledWith("/(tabs)/home");
  });
});
