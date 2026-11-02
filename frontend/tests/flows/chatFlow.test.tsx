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
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { PaperProvider } from "react-native-paper";

const mockGetConversation = jest.fn();
const mockGetMessages = jest.fn();
const mockSendMessage = jest.fn();
const mockCreateConversation = jest.fn();
const mockDeleteConversation = jest.fn();

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
    dismiss: jest.fn(),
  },
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ conversationId: "conv-1" }),
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
    <PaperProvider theme={lightPaperTheme}>
      <ChatConversationScreen />
    </PaperProvider>,
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
  beforeEach(() => {
    jest.clearAllMocks();
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

  it("shows a retryable error state when the conversation cannot be loaded", async () => {
    mockGetConversation.mockRejectedValue(new Error("boom"));

    await renderScreen();

    await waitFor(() => {
      expect(screen.getByText(i18n.t("common.retry"))).toBeTruthy();
    });
  });
});
