import i18n from "@/i18n";
import { generateUuid } from "@/lib/uuid";
import { lightPaperTheme } from "@/theme/paperTheme";
/**
 * Chat flow (contract Section 9.10 + Section 13 "screen-level flows").
 *
 * Covered:
 *  - optimistic "sending" bubble while the request is in flight
 *  - failed send keeps the bubble and the typed text and offers a Retry
 *  - the Retry reuses the same clientMessageId and Idempotency-Key
 *  - the Idempotency-Key is a UUID (the backend rejects everything else)
 */
import { act, fireEvent, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import React from "react";
import { Keyboard } from "react-native";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";

const mockGetConversation = jest.fn();
const mockGetMessages = jest.fn();
const mockSendMessage = jest.fn();
const mockCreateConversation = jest.fn();
const mockDeleteConversation = jest.fn();
let mockSearchParams: { conversationId: string; sourceId?: string } = { conversationId: "conv-1" };

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
    dismiss: jest.fn(),
  },
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => mockSearchParams,
}));

jest.mock("@/auth/AuthProvider", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isGuest: true,
    user: {
      id: "user-1",
      displayName: "ทดสอบ",
      isGuest: true,
      preferences: {},
      consent: { aiProcessing: true, version: "2026-01-01", acceptedAt: null },
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  }),
}));

jest.mock("@/api/endpoints/chat", () => ({
  getConversation: (...args: unknown[]) => mockGetConversation(...args),
  getMessages: (...args: unknown[]) => mockGetMessages(...args),
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
  createConversation: (...args: unknown[]) => mockCreateConversation(...args),
  deleteConversation: (...args: unknown[]) => mockDeleteConversation(...args),
}));

const ChatConversationScreen = require("../../app/chat/[conversationId]").default;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const conversation = {
  id: "conv-1",
  title: "คุยกับเอกสาร",
  sourceId: null,
  lastMessagePreview: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function assistantMessage(content: string) {
  return {
    id: "msg-assistant",
    conversationId: conversation.id,
    role: "assistant" as const,
    content,
    grounding: "general" as const,
    citations: [],
    suggestedFollowUps: [],
    clientMessageId: null,
    createdAt: "2026-01-01T00:00:01.000Z",
  };
}

function userMessage(content: string, clientMessageId: string) {
  return {
    id: "msg-user",
    conversationId: conversation.id,
    role: "user" as const,
    content,
    grounding: null,
    citations: [],
    suggestedFollowUps: [],
    clientMessageId,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function renderScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 44, bottom: 34, left: 0, right: 0 },
      }}
    >
      <PaperProvider theme={lightPaperTheme}>
        <ChatConversationScreen />
      </PaperProvider>
    </SafeAreaProvider>,
  );
}

async function typeMessage(text: string) {
  const input = screen.getByPlaceholderText(i18n.t("chat.placeholder"));
  await fireEvent.changeText(input, text);
}

function pressSend() {
  return fireEvent.press(screen.getByLabelText(i18n.t("chat.send")));
}

async function waitForInput() {
  await waitFor(() => {
    expect(screen.getByPlaceholderText(i18n.t("chat.placeholder"))).toBeTruthy();
  });
}

describe("chat conversation flow", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Keyboard, "addListener").mockImplementation(() => ({ remove: jest.fn() }));
    await i18n.changeLanguage("th");
    mockSearchParams = { conversationId: "conv-1" };
    mockSendMessage.mockReset();
    mockCreateConversation.mockReset().mockResolvedValue(conversation);
    mockDeleteConversation.mockReset().mockResolvedValue(undefined);
    mockGetConversation.mockResolvedValue(conversation);
    mockGetMessages.mockResolvedValue({ items: [], nextCursor: null });
  });

  it("loads the conversation and shows the empty state", async () => {
    await renderScreen();

    await waitFor(() => {
      expect(screen.getByText(i18n.t("chat.emptyConversation"))).toBeTruthy();
    });
    expect(mockGetConversation).toHaveBeenCalledWith(conversation.id);
    expect(mockGetMessages).toHaveBeenCalledWith(conversation.id);
  });

  it("shows an optimistic sending bubble and then the server messages", async () => {
    let resolveSend: ((value: unknown) => void) | undefined;
    mockSendMessage.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSend = resolve;
        }),
    );

    await renderScreen();
    await waitForInput();

    await typeMessage("สรุปให้หน่อย");
    void pressSend();

    await waitFor(() => {
      expect(screen.getByText(i18n.t("chat.sending"))).toBeTruthy();
    });
    expect(screen.getByText("สรุปให้หน่อย")).toBeTruthy();
    expect(screen.getByPlaceholderText(i18n.t("chat.placeholder"))).toHaveDisplayValue("");
    expect(screen.queryByText(i18n.t("chat.emptyConversation"))).toBeNull();

    resolveSend?.({
      userMessage: userMessage("สรุปให้หน่อย", "cm-1"),
      assistantMessage: assistantMessage("นี่คือสรุปครับ"),
    });

    await waitFor(() => {
      expect(screen.getByText("นี่คือสรุปครับ")).toBeTruthy();
    });
    expect(screen.queryByText(i18n.t("chat.sending"))).toBeNull();
  });

  it("keeps the bubble and the typed text when the send fails", async () => {
    mockSendMessage.mockRejectedValue(new Error("network down"));

    await renderScreen();
    await waitForInput();

    await typeMessage("สรุปให้หน่อย");
    await pressSend();

    await waitFor(() => {
      expect(screen.getByText(i18n.t("chat.failedToSend"))).toBeTruthy();
    });
    expect(screen.getByTestId("chat-bubble-retry")).toBeTruthy();
    // The typed text is preserved so the user does not have to type again.
    expect(screen.getByPlaceholderText(i18n.t("chat.placeholder")).props.value).toBe("สรุปให้หน่อย");
  });

  it("reuses the same clientMessageId and Idempotency-Key when retrying", async () => {
    mockSendMessage.mockRejectedValueOnce(new Error("network down"));
    mockSendMessage.mockResolvedValueOnce({
      userMessage: userMessage("สรุปให้หน่อย", "cm-1"),
      assistantMessage: assistantMessage("นี่คือสรุปครับ"),
    });

    await renderScreen();
    await waitForInput();

    await typeMessage("สรุปให้หน่อย");
    await pressSend();

    await waitFor(() => {
      expect(screen.getByTestId("chat-bubble-retry")).toBeTruthy();
    });

    await fireEvent.press(screen.getByTestId("chat-bubble-retry"));

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledTimes(2);
    });

    const firstCall = mockSendMessage.mock.calls[0][0];
    const retryCall = mockSendMessage.mock.calls[1][0];

    // The retry has to reuse both ids so the backend can de-duplicate.
    expect(retryCall.clientMessageId).toBe(firstCall.clientMessageId);
    expect(retryCall.idempotencyKey).toBe(firstCall.idempotencyKey);
    expect(retryCall.content).toBe("สรุปให้หน่อย");

    // The backend validates the Idempotency-Key as a UUID.
    expect(firstCall.idempotencyKey).toMatch(UUID_PATTERN);
    expect(firstCall.clientMessageId).toMatch(UUID_PATTERN);

    await waitFor(() => {
      expect(screen.getByText("นี่คือสรุปครับ")).toBeTruthy();
    });
  });

  it("generates valid UUIDs for the idempotency keys", () => {
    expect(generateUuid()).toMatch(UUID_PATTERN);
    expect(generateUuid()).not.toBe(generateUuid());
  });

  it("preserves the next draft when an earlier message finishes", async () => {
    let resolveSend: (value: unknown) => void = () => {};
    mockSendMessage.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSend = resolve;
        }),
    );
    await renderScreen();
    await waitForInput();
    await typeMessage("first message");
    void pressSend();
    await waitFor(() => expect(mockSendMessage).toHaveBeenCalledTimes(1));
    await typeMessage("next draft");
    await act(async () =>
      resolveSend({
        userMessage: userMessage("first message", "cm-1"),
        assistantMessage: assistantMessage("reply"),
      }),
    );
    expect(screen.getByPlaceholderText(i18n.t("chat.placeholder"))).toHaveDisplayValue(
      "next draft",
    );
  });

  it("sends only once when the send button is pressed twice quickly", async () => {
    let resolveSend: (value: unknown) => void = () => {};
    mockSendMessage.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSend = resolve;
        }),
    );
    const rendered = await renderScreen();
    await waitForInput();
    await typeMessage("one message");
    const button = rendered.getByRole("button", { name: i18n.t("chat.send") });
    await userEvent.press(button);
    await userEvent.press(button);
    await waitFor(() => expect(mockSendMessage).toHaveBeenCalledTimes(1));
    await act(async () =>
      resolveSend({
        userMessage: userMessage("one message", "cm-1"),
        assistantMessage: assistantMessage("reply"),
      }),
    );
  });

  it("cancels the request when leaving a conversation", async () => {
    mockSendMessage.mockImplementation(
      ({ signal }: { signal: AbortSignal }) =>
        new Promise((_, reject) => {
          signal.addEventListener("abort", () => reject(new Error("Request canceled")));
        }),
    );
    const rendered = await renderScreen();
    await waitForInput();
    await typeMessage("one message");
    const completion = pressSend();
    await waitFor(() => expect(mockSendMessage).toHaveBeenCalledTimes(1));
    const signal = mockSendMessage.mock.calls[0][0].signal as AbortSignal;
    await rendered.unmount();
    await completion;
    expect(signal.aborted).toBe(true);
  });

  it("reuses retry IDs when the failed text is sent with the send button", async () => {
    mockSendMessage.mockRejectedValueOnce(new Error("offline"));
    mockSendMessage.mockResolvedValueOnce({
      userMessage: userMessage("retry this", "cm-1"),
      assistantMessage: assistantMessage("reply"),
    });
    await renderScreen();
    await waitForInput();
    await typeMessage("retry this");
    await pressSend();
    await waitFor(() => expect(screen.getByTestId("chat-bubble-retry")).toBeTruthy());
    await pressSend();
    expect(mockSendMessage.mock.calls[1][0].idempotencyKey).toBe(
      mockSendMessage.mock.calls[0][0].idempotencyKey,
    );
    expect(mockSendMessage.mock.calls[1][0].clientMessageId).toBe(
      mockSendMessage.mock.calls[0][0].clientMessageId,
    );
  });

  it.each(["th", "en"])(
    "shows a translated delete dialog and deletes once (%s)",
    async (language) => {
      await i18n.changeLanguage(language);
      await renderScreen();
      await waitForInput();
      await fireEvent.press(screen.getByLabelText(i18n.t("common.delete")));
      expect(screen.getByText(i18n.t("chat.deleteConfirm"))).toBeTruthy();
      expect(screen.queryByText("deleteConfirm")).toBeNull();
      await fireEvent.press(screen.getByRole("button", { name: i18n.t("chat.deleteTitle") }));
      expect(mockDeleteConversation).toHaveBeenCalledTimes(1);
      expect(mockDeleteConversation).toHaveBeenCalledWith("conv-1");
    },
  );

  it("aborts an in-flight reply when the conversation is deleted", async () => {
    let resolveSend: (value: unknown) => void = () => {};
    mockSendMessage.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSend = resolve;
        }),
    );
    await renderScreen();
    await waitForInput();
    await typeMessage("first message");
    void pressSend();
    await waitFor(() => expect(mockSendMessage).toHaveBeenCalledTimes(1));
    const signal = mockSendMessage.mock.calls[0][0].signal as AbortSignal;
    await fireEvent.press(screen.getByLabelText(i18n.t("common.delete")));
    await fireEvent.press(screen.getByRole("button", { name: i18n.t("chat.deleteTitle") }));
    expect(signal.aborted).toBe(true);
    await act(async () =>
      resolveSend({
        userMessage: userMessage("first message", "cm-1"),
        assistantMessage: assistantMessage("late reply"),
      }),
    );
    expect(screen.queryByText("late reply")).toBeNull();
  });

  it("keeps the conversation available when deletion fails", async () => {
    mockDeleteConversation.mockRejectedValue(new Error("Deletion unavailable"));
    await renderScreen();
    await waitForInput();
    await fireEvent.press(screen.getByLabelText(i18n.t("common.delete")));
    await fireEvent.press(screen.getByRole("button", { name: i18n.t("chat.deleteTitle") }));
    expect(screen.getByText("Deletion unavailable")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: i18n.t("common.cancel") }));
    expect(screen.getByPlaceholderText(i18n.t("chat.placeholder"))).toBeTruthy();
  });

  it("reuses a newly created conversation if loading its messages needs a retry", async () => {
    mockSearchParams = { conversationId: "new" };
    mockGetMessages.mockRejectedValueOnce(new Error("Temporary load failure"));
    await renderScreen();
    await waitFor(() => expect(screen.getByText(i18n.t("common.retry"))).toBeTruthy());
    await fireEvent.press(screen.getByText(i18n.t("common.retry")));
    await waitForInput();
    expect(mockCreateConversation).toHaveBeenCalledTimes(1);
  });

  it("shows a retryable error state when the conversation cannot be loaded", async () => {
    mockGetConversation.mockRejectedValue(new Error("boom"));

    await renderScreen();

    await waitFor(() => {
      expect(screen.getByText(i18n.t("common.retry"))).toBeTruthy();
    });
  });
});
