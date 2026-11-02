import type { CardRating } from "@/api/types";
import i18n from "@/i18n";
import { tokens } from "@/theme/tokens";
import { type AppTheme, useAppTheme as useTheme } from "@/theme/useAppTheme";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from "react-native";

const RATINGS: CardRating[] = ["again", "hard", "good", "easy"];

const RATING_LABEL_KEYS: Record<CardRating, string> = {
  again: "study.again",
  hard: "study.hard",
  good: "study.good",
  easy: "study.easy",
};

const createRATING_BUTTON_STYLES = (theme: AppTheme): Record<CardRating, ViewStyle> => ({
  again: { backgroundColor: theme.colors.errorContainer, borderColor: theme.colors.error },
  hard: { backgroundColor: theme.colors.warningContainer, borderColor: theme.colors.warning },
  good: { backgroundColor: theme.colors.infoContainer, borderColor: theme.colors.info },
  easy: { backgroundColor: theme.colors.successContainer, borderColor: theme.colors.success },
});

const createRATING_TEXT_COLORS = (theme: AppTheme): Record<CardRating, string> => ({
  again: theme.colors.onErrorContainer,
  hard: theme.colors.onWarningContainer,
  good: theme.colors.onInfoContainer,
  easy: theme.colors.onSuccessContainer,
});

export function ratingLabel(rating: CardRating): string {
  return i18n.t(RATING_LABEL_KEYS[rating]);
}

interface RatingButtonsProps {
  onRate: (rating: CardRating) => void;
  disabled?: boolean;
  style?: ViewStyle;
}

/**
 * The four self-assessment ratings of a flashcard (contract Section 9.6).
 */
export function RatingButtons({ onRate, disabled = false, style }: RatingButtonsProps) {
  const theme = useTheme();
  const RATING_BUTTON_STYLES = createRATING_BUTTON_STYLES(theme);
  const RATING_TEXT_COLORS = createRATING_TEXT_COLORS(theme);
  const styles = createStyles(theme);
  return (
    <View style={[styles.ratingRow, style]}>
      {RATINGS.map((rating) => (
        <TouchableOpacity
          key={rating}
          style={[styles.ratingButton, RATING_BUTTON_STYLES[rating]]}
          onPress={() => onRate(rating)}
          activeOpacity={0.9}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={ratingLabel(rating)}
          testID={`rating-${rating}`}
        >
          <Text
            style={[
              { color: theme.colors.onSurface },
              [styles.ratingText, { color: RATING_TEXT_COLORS[rating] }],
            ]}
          >
            {ratingLabel(rating)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    ratingRow: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 20,
      paddingBottom: 30,
      justifyContent: "center",
    },
    ratingButton: {
      flex: 1,
      maxWidth: 80,
      paddingVertical: 12,
      borderRadius: tokens.radii.lg,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
    },
    ratingText: {
      fontSize: 13,
      fontWeight: "700",
    },
  });
