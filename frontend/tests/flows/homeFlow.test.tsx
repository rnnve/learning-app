import i18n from "@/i18n";
import { darkPaperTheme, lightPaperTheme } from "@/theme/paperTheme";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { PaperProvider } from "react-native-paper";

const mockPush = jest.fn();
const mockGetHome = jest.fn();
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: require("react-native").View }));
jest.mock("expo-router", () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
  useFocusEffect: (effect: () => void) => require("react").useEffect(effect, [effect]),
}));
jest.mock("@/api/endpoints/home", () => ({ getHome: () => mockGetHome() }));
jest.mock("@/auth/AuthProvider", () => ({
  useAuth: () => ({ user: { displayName: "Test" }, isAuthenticated: true, hasConsent: true }),
}));
const HomeScreen = require("../../app/(tabs)/home").default;

describe("home job links", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetHome.mockResolvedValue({
      stats: { sources: 1, materials: 0, sessionsLast7Days: 0 },
      activeJobs: [
        {
          id: "job-1",
          type: "source_processing",
          sourceId: "source-1",
          status: "running",
          stage: "ocr",
          progress: 45,
          result: null,
        },
      ],
      recentSources: [],
      recentMaterials: [],
    });
  });
  it.each([lightPaperTheme, darkPaperTheme])(
    "opens the active source with the theme applied (dark=$dark)",
    async (theme) => {
      await render(
        <PaperProvider theme={theme}>
          <HomeScreen />
        </PaperProvider>,
      );
      await waitFor(() => expect(screen.getByText("45%")).toBeTruthy());
      await fireEvent.press(screen.getByText(i18n.t("source.processingTitle")));
      expect(mockPush).toHaveBeenCalledWith("/source/source-1");
    },
    15000,
  );
});
