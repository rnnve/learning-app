import i18n from "@/i18n";
import { lightPaperTheme } from "@/theme/paperTheme";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";

const mockGetConversations = jest.fn();
const mockGetSources = jest.fn();
let mockRefocus: () => void = () => {};
jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  useFocusEffect: (callback: () => void) => {
    mockRefocus = callback;
    require("react").useEffect(callback, [callback]);
  },
}));
jest.mock("@/auth/AuthProvider", () => ({ useAuth: () => ({ isAuthenticated: true }) }));
jest.mock("@/api/endpoints/chat", () => ({
  getConversations: () => mockGetConversations(),
  createConversation: jest.fn(),
}));
jest.mock("@/api/endpoints/sources", () => ({ getSources: () => mockGetSources() }));
const ChatList = require("../../app/(tabs)/chat").default;

function renderList() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 44, bottom: 34, left: 0, right: 0 },
      }}
    >
      <PaperProvider theme={lightPaperTheme}>
        <ChatList />
      </PaperProvider>
    </SafeAreaProvider>,
  );
}

describe("chat inbox updates", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await i18n.changeLanguage("th");
    mockGetConversations.mockResolvedValue({ items: [], nextCursor: null });
    mockGetSources.mockResolvedValue({ items: [], nextCursor: null });
  });

  it("refreshes the inbox when returning from a conversation", async () => {
    await renderList();
    await waitFor(() =>
      expect(screen.getByText(i18n.t("chat.emptyInboxDescription"))).toBeTruthy(),
    );
    mockGetConversations.mockResolvedValue({
      items: [
        {
          id: "conv-1",
          title: "New conversation",
          sourceId: null,
          updatedAt: "2026-11-02T12:00:00Z",
        },
      ],
    });
    await act(async () => mockRefocus());
    await waitFor(() => expect(screen.getByText("New conversation")).toBeTruthy());
    mockGetConversations.mockResolvedValue({ items: [] });
    await act(async () => mockRefocus());
    await waitFor(() => expect(screen.queryByText("New conversation")).toBeNull());
  });

  it("describes general chat correctly and refreshes newly available documents", async () => {
    await renderList();
    await waitFor(() =>
      expect(screen.getByText(i18n.t("chat.emptyInboxDescription"))).toBeTruthy(),
    );
    mockGetSources.mockResolvedValue({
      items: [
        {
          id: "source-1",
          title: "Newly uploaded notes",
          status: "ready",
          kind: "pdf",
          pageCount: 3,
          createdAt: "2026-11-02T12:00:00Z",
        },
      ],
    });
    await fireEvent.press(screen.getByText(i18n.t("chat.newChat")));
    await waitFor(() => expect(screen.getByText("Newly uploaded notes")).toBeTruthy());
    expect(screen.getByText(i18n.t("chat.generalDescription"))).toBeTruthy();
    expect(screen.getAllByText(i18n.t("chat.selectSourcePrompt"))).toHaveLength(1);
  });
});
