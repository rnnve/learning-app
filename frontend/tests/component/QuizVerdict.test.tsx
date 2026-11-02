import { QuizVerdict } from "@/components/ui/QuizVerdict";
import i18n from "@/i18n";
import { lightPaperTheme } from "@/theme/paperTheme";
/**
 * Quiz verdict component test (contract Section 9.7 / 13): after an answer has
 * been graded the verdict has to be displayed with its explanation.
 */
import { render, screen } from "@testing-library/react-native";
import type React from "react";
import { PaperProvider } from "react-native-paper";

function withTheme(node: React.ReactElement) {
  return <PaperProvider theme={lightPaperTheme}>{node}</PaperProvider>;
}

describe("QuizVerdict", () => {
  it("shows the correct verdict with its icon", async () => {
    await render(withTheme(<QuizVerdict verdict="correct" />));

    expect(screen.getByText(`✓ ${i18n.t("enums.verdicts.correct")}`)).toBeTruthy();
  });

  it("shows the partially correct verdict", async () => {
    await render(withTheme(<QuizVerdict verdict="partially_correct" />));

    expect(screen.getByText(`⚠ ${i18n.t("enums.verdicts.partially_correct")}`)).toBeTruthy();
  });

  it("shows the incorrect verdict", async () => {
    await render(withTheme(<QuizVerdict verdict="incorrect" />));

    expect(screen.getByText(`✗ ${i18n.t("enums.verdicts.incorrect")}`)).toBeTruthy();
  });

  it("shows the explanation returned by the backend", async () => {
    await render(withTheme(<QuizVerdict verdict="correct" explanation="เพราะ..." />));

    expect(screen.getByText("เพราะ...")).toBeTruthy();
  });

  it("shows the explanation of the question", async () => {
    await render(withTheme(<QuizVerdict verdict="incorrect" questionExplanation="ดูหน้า 4" />));

    expect(screen.getByText(`${i18n.t("study.explanation")}: ดูหน้า 4`)).toBeTruthy();
  });

  it("hides the explanation blocks when there is nothing to show", async () => {
    await render(withTheme(<QuizVerdict verdict="correct" />));

    expect(screen.getByTestId("quiz-verdict")).toBeTruthy();
    expect(screen.queryByText(/:/)).toBeNull();
  });

  it("uses a different colour per verdict", async () => {
    await render(withTheme(<QuizVerdict verdict="correct" />));
    expect(screen.getByTestId("quiz-verdict")).toHaveStyle({
      backgroundColor: lightPaperTheme.colors.successContainer,
    });
  });

  it("uses the warning colour for a partially correct answer", async () => {
    await render(withTheme(<QuizVerdict verdict="partially_correct" />));
    expect(screen.getByTestId("quiz-verdict")).toHaveStyle({
      backgroundColor: lightPaperTheme.colors.warningContainer,
    });
  });

  it("uses the error colour for an incorrect answer", async () => {
    await render(withTheme(<QuizVerdict verdict="incorrect" />));
    expect(screen.getByTestId("quiz-verdict")).toHaveStyle({
      backgroundColor: lightPaperTheme.colors.errorContainer,
    });
  });
});
