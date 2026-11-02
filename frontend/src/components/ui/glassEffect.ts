import { Platform } from "react-native";

export interface LiquidGlassSupport {
  /** True when the running platform can render the native liquid glass effect. */
  available: boolean;
  /** The native component, `null` when liquid glass is not available. */
  GlassView: React.ComponentType<any> | null;
}

const UNAVAILABLE: LiquidGlassSupport = { available: false, GlassView: null };

/**
 * Detects the native liquid glass support of the running platform.
 *
 * `expo-glass-effect` is an optional native module: it is only present in
 * iOS builds. The detection is wrapped in a try/catch so that a missing
 * module (or a missing native binary) simply downgrades the surface to the
 * blur level instead of crashing the screen.
 */
export function detectLiquidGlass(): LiquidGlassSupport {
  if (Platform.OS !== "ios") return UNAVAILABLE;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const glassEffect = require("expo-glass-effect");
    if (glassEffect && typeof glassEffect.isLiquidGlassAvailable === "function") {
      return {
        available: glassEffect.isLiquidGlassAvailable() === true,
        GlassView: glassEffect.GlassView ?? null,
      };
    }
  } catch {
    // expo-glass-effect is not installed - fall through to the blur level.
  }

  return UNAVAILABLE;
}
