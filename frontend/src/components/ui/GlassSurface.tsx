import { tokens } from "@/theme/tokens";
import { type AppTheme, useAppTheme as useTheme } from "@/theme/useAppTheme";
import { BlurView } from "expo-blur";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, Platform, StyleSheet, View, type ViewStyle } from "react-native";
import { detectLiquidGlass } from "./glassEffect";

/**
 * The three fallback levels of a glass surface:
 *  1. `liquidGlass` - the native iOS liquid glass effect
 *  2. `blur`       - the cross platform `expo-blur` blur view
 *  3. `solid`      - a plain translucent surface (reduced transparency)
 */
export type GlassSurfaceVariant = "liquidGlass" | "blur" | "solid";

export interface GlassSurfaceDecision {
  /** The current platform, e.g. `ios` or `android`. */
  platformOS: string;
  /** Whether the native liquid glass effect is available. */
  liquidGlassAvailable: boolean;
  /** Whether the user asked for reduced transparency. */
  reduceTransparency: boolean;
}

/**
 * Pure selection of the glass level. Kept separate from the component so the
 * fallback order can be verified without rendering.
 */
export function selectGlassSurfaceVariant({
  platformOS,
  liquidGlassAvailable,
  reduceTransparency,
}: GlassSurfaceDecision): GlassSurfaceVariant {
  if (reduceTransparency) return "solid";
  if (platformOS !== "ios") return "solid";
  if (liquidGlassAvailable) return "liquidGlass";
  return "blur";
}

interface GlassSurfaceProps {
  children?: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  borderRadius?: number;
}

export function GlassSurface({
  children,
  style,
  intensity = 50,
  borderRadius = tokens.radii.xl,
}: GlassSurfaceProps) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const paperTheme = useTheme();
  const [reduceTransparency, setReduceTransparency] = useState(false);
  const liquidGlass = useMemo(() => detectLiquidGlass(), []);

  useEffect(() => {
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then(setReduceTransparency)
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setReduceTransparency,
    );
    return () => sub.remove();
  }, []);

  const isDark = paperTheme.dark;
  const glassTokens = isDark ? tokens.colors.dark : tokens.colors.light;

  const variant = selectGlassSurfaceVariant({
    platformOS: Platform.OS,
    liquidGlassAvailable: liquidGlass.available,
    reduceTransparency,
  });

  // Material surfaces stay solid off iOS. Liquid Glass and its blur fallback
  // are deliberately iOS-only so Android keeps native Material 3 behavior.
  if (variant === "solid") {
    return (
      <View
        testID="glass-surface-solid"
        style={[
          styles.base,
          {
            borderRadius,
            backgroundColor: glassTokens.glassBackground,
            borderColor: glassTokens.glassBorder,
            borderWidth: 1,
            shadowColor: glassTokens.shadow,
          },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  // Level 1: native liquid glass on iOS.
  if (variant === "liquidGlass" && liquidGlass.GlassView) {
    const GlassViewComponent = liquidGlass.GlassView;
    return (
      <GlassViewComponent
        colorScheme={paperTheme.dark ? "dark" : "light"}
        testID="glass-surface-liquid"
        style={[
          styles.base,
          {
            borderRadius,
            borderColor: glassTokens.glassBorder,
            borderWidth: 1,
          },
          style,
        ]}
      >
        {children}
      </GlassViewComponent>
    );
  }

  // Level 2: cross platform blur.
  return (
    <View
      testID="glass-surface-blur"
      style={[
        styles.base,
        styles.overflowHidden,
        {
          borderRadius,
          borderColor: glassTokens.glassBorder,
          borderWidth: 1,
        },
        style,
      ]}
    >
      <BlurView
        intensity={intensity}
        tint={isDark ? "dark" : "light"}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ backgroundColor: glassTokens.glassBackground }}>{children}</View>
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    base: {
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 10,
      elevation: 3,
    },
    overflowHidden: {
      overflow: "hidden",
    },
  });
