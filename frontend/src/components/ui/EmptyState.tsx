import { tokens } from "@/theme/tokens";
import { type AppTheme, useAppTheme as useTheme } from "@/theme/useAppTheme";
import type React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { PrimaryButton } from "./Buttons";

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
  icon?: React.ReactNode;
  illustration?: string;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  style,
  icon,
  illustration,
}: EmptyStateProps) {
  const theme = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={[styles.container, style]}>
      {illustration && (
        <Text style={[{ color: theme.colors.onSurface }, styles.illustration]}>{illustration}</Text>
      )}
      {icon && (
        <View style={styles.iconContainer}>
          {typeof icon === "string" ? (
            <Text style={[{ color: theme.colors.onSurface }, styles.iconText]}>{icon}</Text>
          ) : (
            icon
          )}
        </View>
      )}
      <Text
        style={[
          { color: theme.colors.onSurface },
          [styles.title, { color: theme.colors.onSurface }],
        ]}
      >
        {title}
      </Text>
      {description && (
        <Text
          style={[
            { color: theme.colors.onSurface },
            [styles.description, { color: theme.colors.onSurfaceVariant }],
          ]}
        >
          {description}
        </Text>
      )}
      {actionLabel && onAction && (
        <PrimaryButton label={actionLabel} onPress={onAction} style={styles.actionButton} />
      )}
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 24,
      paddingVertical: 24,
      alignItems: "center",
      justifyContent: "center",
      marginVertical: 16,
    },
    illustration: {
      fontSize: 48,
      marginBottom: 16,
    },
    iconContainer: {
      marginBottom: 12,
    },
    iconText: {
      fontSize: 42,
      lineHeight: 50,
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      textAlign: "center",
      marginBottom: 8,
    },
    description: {
      fontSize: 14,
      lineHeight: 22,
      textAlign: "center",
      marginBottom: 20,
      maxWidth: 320,
    },
    actionButton: {
      minWidth: 160,
    },
  });
