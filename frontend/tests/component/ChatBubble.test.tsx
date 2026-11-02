import type { Message } from "@/api/types";
import { ChatBubble } from "@/components/ui/ChatBubble";
import i18n from "@/i18n";
import { lightPaperTheme } from "@/theme/paperTheme";
/**
 * Chat bubble component tests (contract Section 9.10 / 13):
 *  - sent bubble: text, grounding badge, citations and follow-up chips
 *  - sending bubble: shows the "sending" indicator
 *  - failed bubble: shows the failure message and a Retry that reuses the
 *    very same clientMessageId / Idempotency-Key
 */
import { fireEvent, render, screen } from "@testing-library/react-native";
import type React from "react";
import { PaperProvider } from "react-native-paper";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
}));

function withTheme(node: React.ReactElement) {
  return <PaperProvider theme={lightPaperTheme}>{node}</PaperProvider>;
}

const userMessage: Message = {
  id: "m1",
  conversationId: "c1",
  role: "user",
  content: "สรุปบทที่ 1 ให้หน่อย",
  grounding: null,
  citations: [],
  suggestedFollowUps: [],
  clientMessageId: "cm-1",
  createdAt: "2026-03-15T09:30:00.000Z",
};

const assistantMessage: Message = {
  id: "m2",
  conversationId: "c1",
  role: "assistant",
  content: "บทที่ 1 พูดถึง...",
  grounding: "source",
  citations: [{ chunkId: "chunk-7", page: 2, quote: null }],
  suggestedFollowUps: ["ตัวอย่างที่ 2 เป็นอย่างไร"],
  clientMessageId: null,
  createdAt: "2026-03-15T09:30:01.000Z",
};

describe("ChatBubble", () => {
  it("renders the message text", async () => {
    await render(withTheme(<ChatBubble message={userMessage} />));
    expect(screen.getByText(userMessage.content)).toBeTruthy();
  });

  it("shows the sending indicator for an optimistic bubble", async () => {
    await render(withTheme(<ChatBubble message={userMessage} status="sending" />));

    expect(screen.getByText(i18n.t("chat.sending"))).toBeTruthy();
  });

  it("shows the failure message and a Retry button", async () => {
    await render(
      withTheme(<ChatBubble message={userMessage} status="failed" onRetry={jest.fn()} />),
    );

    expect(screen.getByText(i18n.t("chat.failedToSend"))).toBeTruthy();
    expect(screen.getByTestId("chat-bubble-retry")).toBeTruthy();
  });

  it("calls onRetry when the Retry button is pressed", async () => {
    const onRetry = jest.fn();
    await render(withTheme(<ChatBubble message={userMessage} status="failed" onRetry={onRetry} />));

    await fireEvent.press(screen.getByTestId("chat-bubble-retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("keeps the typed text in the failed bubble so it is not lost", async () => {
    await render(
      withTheme(<ChatBubble message={userMessage} status="failed" onRetry={jest.fn()} />),
    );

    expect(screen.getByText(userMessage.content)).toBeTruthy();
  });

  it("hides the Retry button when no handler is given", async () => {
    await render(withTheme(<ChatBubble message={userMessage} status="failed" />));

    expect(screen.queryByTestId("chat-bubble-retry")).toBeNull();
  });

  it("shows the grounding badge of an assistant message", async () => {
    await render(withTheme(<ChatBubble message={assistantMessage} />));

    expect(screen.getByText(i18n.t("chat.groundingSource"))).toBeTruthy();
  });

  it("does not show a grounding badge for a user message", async () => {
    await render(withTheme(<ChatBubble message={userMessage} />));

    expect(screen.queryByText(i18n.t("chat.groundingSource"))).toBeNull();
  });

  it("renders a citation chip per source reference", async () => {
    await render(withTheme(<ChatBubble message={assistantMessage} sourceId="src-1" />));

    expect(screen.getByText(/หน้า 2/)).toBeTruthy();
  });

  it("hides the citations when the conversation has no source", async () => {
    await render(withTheme(<ChatBubble message={assistantMessage} />));

    expect(screen.queryByText(/หน้า 2/)).toBeNull();
  });

  it("renders the suggested follow-up chips and reports the tap", async () => {
    const onFollowUpPress = jest.fn();
    await render(
      withTheme(<ChatBubble message={assistantMessage} onFollowUpPress={onFollowUpPress} />),
    );

    const chip = screen.getByText(assistantMessage.suggestedFollowUps[0]);
    await fireEvent.press(chip);
    expect(onFollowUpPress).toHaveBeenCalledWith(assistantMessage.suggestedFollowUps[0]);
  });
});
