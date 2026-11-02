import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from "react-native-paper";
import { tokens } from "./tokens";

export type AppTheme = MD3Theme & {
  colors: MD3Theme["colors"] & Record<keyof typeof tokens.colors.light, string>;
};

export const lightPaperTheme: AppTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    ...tokens.colors.light,
    primary: tokens.colors.light.primary,
    onPrimary: tokens.colors.light.onPrimary,
    primaryContainer: tokens.colors.light.primaryContainer,
    onPrimaryContainer: tokens.colors.light.onPrimaryContainer,
    secondary: tokens.colors.light.secondary,
    onSecondary: tokens.colors.light.onSecondary,
    secondaryContainer: tokens.colors.light.secondaryContainer,
    onSecondaryContainer: tokens.colors.light.onSecondaryContainer,
    tertiary: tokens.colors.light.tertiary,
    onTertiary: tokens.colors.light.onTertiary,
    tertiaryContainer: tokens.colors.light.tertiaryContainer,
    onTertiaryContainer: tokens.colors.light.onTertiaryContainer,
    background: tokens.colors.light.background,
    onBackground: tokens.colors.light.onBackground,
    surface: tokens.colors.light.surface,
    onSurface: tokens.colors.light.onSurface,
    surfaceVariant: tokens.colors.light.surfaceVariant,
    onSurfaceVariant: tokens.colors.light.onSurfaceVariant,
    outline: tokens.colors.light.outline,
    outlineVariant: tokens.colors.light.outlineVariant,
    error: tokens.colors.light.error,
    onError: tokens.colors.light.onError,
    errorContainer: tokens.colors.light.errorContainer,
    onErrorContainer: tokens.colors.light.onErrorContainer,
  },
  roundness: 24,
};

export const darkPaperTheme: AppTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    ...tokens.colors.dark,
    primary: tokens.colors.dark.primary,
    onPrimary: tokens.colors.dark.onPrimary,
    primaryContainer: tokens.colors.dark.primaryContainer,
    onPrimaryContainer: tokens.colors.dark.onPrimaryContainer,
    secondary: tokens.colors.dark.secondary,
    onSecondary: tokens.colors.dark.onSecondary,
    secondaryContainer: tokens.colors.dark.secondaryContainer,
    onSecondaryContainer: tokens.colors.dark.onSecondaryContainer,
    tertiary: tokens.colors.dark.tertiary,
    onTertiary: tokens.colors.dark.onTertiary,
    tertiaryContainer: tokens.colors.dark.tertiaryContainer,
    onTertiaryContainer: tokens.colors.dark.onTertiaryContainer,
    background: tokens.colors.dark.background,
    onBackground: tokens.colors.dark.onBackground,
    surface: tokens.colors.dark.surface,
    onSurface: tokens.colors.dark.onSurface,
    surfaceVariant: tokens.colors.dark.surfaceVariant,
    onSurfaceVariant: tokens.colors.dark.onSurfaceVariant,
    outline: tokens.colors.dark.outline,
    outlineVariant: tokens.colors.dark.outlineVariant,
    error: tokens.colors.dark.error,
    onError: tokens.colors.dark.onError,
    errorContainer: tokens.colors.dark.errorContainer,
    onErrorContainer: tokens.colors.dark.onErrorContainer,
  },
  roundness: 24,
};
