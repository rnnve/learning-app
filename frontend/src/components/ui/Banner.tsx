import { tokens } from "@/theme/tokens";
import { type AppTheme, useAppTheme as useTheme } from "@/theme/useAppTheme";
import type React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";

export type BannerVariant = "info" | "warning" | "error" | "fixture";

interface BannerProps {
  message: string;
  variant?: BannerVariant;
  style?: ViewStyle;
  icon?: React.ReactNode;
}

export function Banner({ message, variant = "info", style, icon }: BannerProps) {
  const theme = useTheme();
  const styles = createStyles(theme);

  const getColors = () => {
    if (variant === "fixture" || variant === "warning") {
      return {
        bg: theme.colors.warningContainer,
        text: theme.colors.onWarningContainer,
        border: theme.colors.warning,
      };
    }
    if (variant === "error") {
      return {
        bg: theme.colors.errorContainer,
        text: theme.colors.onErrorContainer,
        border: theme.colors.error,
      };
    }
    return {
      bg: theme.colors.primaryContainer,
      text: theme.colors.onPrimaryContainer,
      border: theme.colors.primary,
    };
  };

  const colors = getColors();

  return (
    <View
      accessible
      accessibilityRole="alert"
      style={[
        styles.container,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <Text style={[{ color: theme.colors.onSurface }, [styles.text, { color: colors.text }]]}>
        {message}
      </Text>
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: tokens.radii.md,
      borderWidth: 1,
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 6,
    },
    iconContainer: {
      marginRight: 8,
    },
    text: {
      fontSize: 14,
      fontWeight: "500",
      lineHeight: 20,
      flex: 1,
    },
  });
