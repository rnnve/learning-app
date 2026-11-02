import type { Verdict } from "@/api/types";
import i18n from "@/i18n";
import { tokens } from "@/theme/tokens";
import { type AppTheme, useAppTheme as useTheme } from "@/theme/useAppTheme";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

const VERDICT_ICONS: Record<Verdict, string> = {
  correct: "✓",
  partially_correct: "⚠",
  incorrect: "✗",
};

interface QuizVerdictProps {
  verdict: Verdict;
  /** Explanation returned by the backend for the submitted answer. */
  explanation?: string | null;
  /** Explanation attached to the question itself. */
  questionExplanation?: string | null;
}

/**
 * Feedback panel shown after a quiz answer has been graded
 * (contract 9.7 / "Quiz verdict display").
 */
export function QuizVerdict({ verdict, explanation, questionExplanation }: QuizVerdictProps) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const isCorrect = verdict === "correct";
  const isPartial = verdict === "partially_correct";

  const containerStyle = isCorrect
    ? styles.feedbackCorrect
    : isPartial
      ? styles.feedbackPartial
      : styles.feedbackIncorrect;

  const titleStyle = isCorrect
    ? styles.feedbackTitleCorrect
    : isPartial
      ? styles.feedbackTitlePartial
      : styles.feedbackTitleIncorrect;

  const bodyStyle = isCorrect
    ? styles.feedbackExplanationCorrect
    : isPartial
      ? styles.feedbackExplanationPartial
      : styles.feedbackExplanationIncorrect;

  return (
    <View style={[styles.feedbackContainer, containerStyle]} testID="quiz-verdict">
      <Text style={[{ color: theme.colors.onSurface }, [styles.feedbackTitle, titleStyle]]}>
        {`${VERDICT_ICONS[verdict]} ${i18n.t(`enums.verdicts.${verdict}`)}`}
      </Text>
      {explanation ? (
        <Text style={[{ color: theme.colors.onSurface }, [styles.feedbackExplanation, bodyStyle]]}>
          {explanation}
        </Text>
      ) : null}
      {questionExplanation ? (
        <Text style={[{ color: theme.colors.onSurface }, [styles.feedbackExplanation, bodyStyle]]}>
          {`${i18n.t("study.explanation")}: ${questionExplanation}`}
        </Text>
      ) : null}
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    feedbackContainer: {
      marginTop: 16,
      padding: 16,
      borderRadius: tokens.radii.lg,
    },
    feedbackCorrect: {
      backgroundColor: theme.colors.successContainer,
      borderWidth: 1,
      borderColor: theme.colors.success,
    },
    feedbackIncorrect: {
      backgroundColor: theme.colors.errorContainer,
      borderWidth: 1,
      borderColor: theme.colors.error,
    },
    feedbackPartial: {
      backgroundColor: theme.colors.warningContainer,
      borderWidth: 1,
      borderColor: theme.colors.warning,
    },
    feedbackTitle: {
      fontSize: 15,
      fontWeight: "700",
      marginBottom: 8,
    },
    feedbackTitleCorrect: { color: theme.colors.onSuccessContainer },
    feedbackTitleIncorrect: { color: theme.colors.onErrorContainer },
    feedbackTitlePartial: { color: theme.colors.onWarningContainer },
    feedbackExplanation: {
      fontSize: 14,
      lineHeight: 22,
    },
    feedbackExplanationCorrect: { color: theme.colors.onSuccessContainer },
    feedbackExplanationIncorrect: { color: theme.colors.onErrorContainer },
    feedbackExplanationPartial: { color: theme.colors.onWarningContainer },
  });
