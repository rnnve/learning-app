import { haptics } from "@/lib/haptics";
import { tokens } from "@/theme/tokens";
import { type AppTheme, useAppTheme as useTheme } from "@/theme/useAppTheme";
import type React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  type TextStyle,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";

interface ButtonProps {
  label: string;
  onPress: () => void | Promise<void>;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
  icon?: React.ReactNode;
  testID?: string;
}

interface IconButtonProps {
  icon: React.ReactNode;
  onPress: () => void | Promise<void>;
  size?: number;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
  testID?: string;
}

export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  style,
  textStyle,
  accessibilityLabel,
  icon,
  testID,
}: ButtonProps) {
  const theme = useTheme();
  const styles = createStyles(theme);

  const handlePress = () => {
    if (disabled || loading) return;
    haptics.light();
    onPress();
  };

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      testID={testID}
      activeOpacity={0.82}
      onPress={handlePress}
      disabled={disabled || loading}
      style={[
        styles.base,
        {
          backgroundColor: disabled ? theme.colors.surfaceVariant : theme.colors.primary,
          shadowColor: theme.colors.primary,
        },
        styles.primaryShadow,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.onPrimary} size="small" />
      ) : (
        <>
          {icon}
          <Text
            style={[
              { color: theme.colors.onSurface },
              [
                styles.primaryText,
                {
                  color: disabled ? theme.colors.onSurfaceVariant : theme.colors.onPrimary,
                  marginLeft: icon ? 8 : 0,
                },
                textStyle,
              ],
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export function SecondaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  style,
  textStyle,
  accessibilityLabel,
  icon,
  testID,
}: ButtonProps) {
  const theme = useTheme();
  const styles = createStyles(theme);

  const handlePress = () => {
    if (disabled || loading) return;
    haptics.light();
    onPress();
  };

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      testID={testID}
      activeOpacity={0.78}
      onPress={handlePress}
      disabled={disabled || loading}
      style={[
        styles.base,
        {
          backgroundColor: "transparent",
          borderColor: disabled ? theme.colors.outlineVariant : theme.colors.outline,
          borderWidth: 1.5,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.primary} size="small" />
      ) : (
        <>
          {icon}
          <Text
            style={[
              { color: theme.colors.onSurface },
              [
                styles.secondaryText,
                {
                  color: disabled ? theme.colors.outline : theme.colors.primary,
                  marginLeft: icon ? 8 : 0,
                },
                textStyle,
              ],
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    base: {
      minHeight: 52,
      minWidth: 44,
      borderRadius: tokens.radii.full,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    primaryShadow: {
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 12,
      elevation: 4,
    },
    primaryText: {
      fontSize: 16,
      fontWeight: "700",
      textAlign: "center",
    },
    secondaryText: {
      fontSize: 16,
      fontWeight: "600",
      textAlign: "center",
    },
    iconBase: {
      borderRadius: tokens.radii.full,
      alignItems: "center",
      justifyContent: "center",
    },
  });

export function IconButton({
  icon,
  onPress,
  size = 40,
  loading = false,
  disabled = false,
  style,
  accessibilityLabel,
  testID,
}: IconButtonProps) {
  const theme = useTheme();
  const styles = createStyles(theme);

  const handlePress = () => {
    if (disabled || loading) return;
    haptics.light();
    onPress();
  };

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      testID={testID}
      activeOpacity={0.7}
      onPress={handlePress}
      disabled={disabled || loading}
      style={[
        styles.iconBase,
        {
          width: size,
          height: size,
          backgroundColor: disabled ? theme.colors.surfaceVariant : theme.colors.surface,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={theme.colors.primary} size="small" /> : icon}
    </TouchableOpacity>
  );
}
