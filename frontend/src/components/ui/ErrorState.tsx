import { localizeError } from "@/api/errors";
import i18n from "@/i18n";
import { tokens } from "@/theme/tokens";
import { type AppTheme, useAppTheme as useTheme } from "@/theme/useAppTheme";
import React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { PrimaryButton } from "./Buttons";

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  style?: ViewStyle;
  customMessage?: string;
  message?: string;
}

export function ErrorState({ error, onRetry, style, customMessage, message }: ErrorStateProps) {
  const theme = useTheme();
  const styles = createStyles(theme);

  const getMessage = (): string => {
    if (message) return message;
    if (customMessage) return customMessage;
    return localizeError(error);
  };

  const displayMessage = getMessage();

  return (
    <View
      accessible
      accessibilityRole="alert"
      style={[
        styles.container,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant },
        style,
      ]}
    >
      <View style={[styles.iconCircle, { backgroundColor: theme.colors.errorContainer }]}>
        <Text
          style={[
            { color: theme.colors.onSurface },
            [styles.exclamation, { color: theme.colors.error }],
          ]}
        >
          !
        </Text>
      </View>
      <Text
        style={[
          { color: theme.colors.onSurface },
          [styles.title, { color: theme.colors.onSurface }],
        ]}
      >
        {i18n.t("common.error")}
      </Text>
      <Text
        style={[
          { color: theme.colors.onSurface },
          [styles.message, { color: theme.colors.onSurfaceVariant }],
        ]}
      >
        {displayMessage}
      </Text>
      {onRetry && (
        <PrimaryButton
          label={i18n.t("common.retry")}
          onPress={onRetry}
          style={styles.retryButton}
        />
      )}
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      padding: 24,
      borderRadius: tokens.radii.xl,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      marginVertical: 12,
    },
    iconCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    exclamation: {
      fontSize: 28,
      fontWeight: "700",
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 8,
    },
    message: {
      fontSize: 14,
      lineHeight: 22,
      textAlign: "center",
      marginBottom: 16,
    },
    retryButton: {
      minWidth: 140,
    },
  });
