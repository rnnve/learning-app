import type { Message } from "@/api/types";
import { ChatBubble } from "@/components/ui/ChatBubble";
import { darkPaperTheme, lightPaperTheme } from "@/theme/paperTheme";
import { render, screen } from "@testing-library/react-native";
import React from "react";
import { PaperProvider } from "react-native-paper";

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const message = {
  id: "message",
  role: "assistant",
  content: "อ่านง่ายทั้งสองธีม",
  citations: [],
  suggestedFollowUps: [],
  grounding: null,
} as unknown as Message;

function luminance(hex: string) {
  const rgb = hex
    .slice(1)
    .match(/../g)!
    .map((v) => Number.parseInt(v, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

describe("light/dark theme", () => {
  it.each([lightPaperTheme, darkPaperTheme])(
    "keeps text readable on matching semantic surfaces (dark=$dark)",
    (theme) => {
      for (const [background, foreground] of [
        [theme.colors.background, theme.colors.onBackground],
        [theme.colors.surface, theme.colors.onSurface],
        [theme.colors.primary, theme.colors.onPrimary],
        [theme.colors.primaryContainer, theme.colors.onPrimaryContainer],
        [theme.colors.errorContainer, theme.colors.onErrorContainer],
        [theme.colors.warningContainer, theme.colors.onWarningContainer],
        [theme.colors.successContainer, theme.colors.onSuccessContainer],
        [theme.colors.infoContainer, theme.colors.onInfoContainer],
      ])
        expect(contrast(background, foreground)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("updates existing chat text when the theme changes", async () => {
    const tree = await render(
      <PaperProvider theme={lightPaperTheme}>
        <ChatBubble message={message} />
      </PaperProvider>,
    );
    expect(screen.getByText(message.content)).toHaveStyle({
      color: lightPaperTheme.colors.onSurface,
    });
    await tree.rerender(
      <PaperProvider theme={darkPaperTheme}>
        <ChatBubble message={message} />
      </PaperProvider>,
    );
    expect(screen.getByText(message.content)).toHaveStyle({
      color: darkPaperTheme.colors.onSurface,
    });
  });
});
