import { lightPaperTheme } from "@/theme/paperTheme";
/**
 * GlassSurface fallback tests (contract Section 13):
 *  - the variant selection follows the three level fallback order
 *  - Level 1: liquid glass when the platform supports it
 *  - Level 2: BlurView when liquid glass is not available
 *  - Level 3: a solid surface when the user asked for reduced transparency
 */
import { render, screen } from "@testing-library/react-native";
import type React from "react";
import { AccessibilityInfo, Text } from "react-native";
import { PaperProvider } from "react-native-paper";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
}));

// The liquid glass support is detected through a dedicated module so the
// availability can be controlled without reloading React.
jest.mock("@/components/ui/glassEffect", () => {
  const state = { available: false, GlassView: null as any };
  return {
    __state: state,
    detectLiquidGlass: () => state,
  };
});

function withTheme(node: React.ReactElement) {
  return <PaperProvider theme={lightPaperTheme}>{node}</PaperProvider>;
}

function setLiquidGlass(available: boolean) {
  const { __state } = require("@/components/ui/glassEffect");
  __state.available = available;
  __state.GlassView = available ? "GlassView" : null;
}

describe("selectGlassSurfaceVariant", () => {
  const { selectGlassSurfaceVariant } = require("@/components/ui/GlassSurface");

  it("uses the liquid glass level on iOS when the effect is available", () => {
    expect(
      selectGlassSurfaceVariant({
        platformOS: "ios",
        liquidGlassAvailable: true,
        reduceTransparency: false,
      }),
    ).toBe("liquidGlass");
  });

  it("falls back to the blur level when the liquid glass effect is missing", () => {
    expect(
      selectGlassSurfaceVariant({
        platformOS: "ios",
        liquidGlassAvailable: false,
        reduceTransparency: false,
      }),
    ).toBe("blur");
  });

  it("uses a solid Material surface on Android", () => {
    expect(
      selectGlassSurfaceVariant({
        platformOS: "android",
        liquidGlassAvailable: true,
        reduceTransparency: false,
      }),
    ).toBe("solid");
  });

  it("prefers the solid level when reduced transparency is requested", () => {
    expect(
      selectGlassSurfaceVariant({
        platformOS: "ios",
        liquidGlassAvailable: true,
        reduceTransparency: true,
      }),
    ).toBe("solid");
  });
});

describe("GlassSurface", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    setLiquidGlass(false);
  });

  it("renders the liquid glass surface when the platform supports it", async () => {
    setLiquidGlass(true);
    const { GlassSurface } = require("@/components/ui/GlassSurface");

    await render(
      withTheme(
        <GlassSurface>
          <Text>content</Text>
        </GlassSurface>,
      ),
    );

    expect(screen.getByTestId("glass-surface-liquid")).toBeTruthy();
    expect(screen.getByText("content")).toBeTruthy();
  });

  it("falls back to the blur surface when liquid glass is not available", async () => {
    setLiquidGlass(false);
    const { GlassSurface } = require("@/components/ui/GlassSurface");

    const view = await render(
      withTheme(
        <GlassSurface>
          <Text>content</Text>
        </GlassSurface>,
      ),
    );

    expect(screen.getByTestId("glass-surface-blur")).toBeTruthy();
    expect(JSON.stringify(view.toJSON())).toContain("BlurView");
    expect(screen.getByText("content")).toBeTruthy();
  });

  it("uses the solid fallback when reduced transparency is requested", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceTransparencyEnabled").mockResolvedValue(true);
    setLiquidGlass(true);
    const { GlassSurface } = require("@/components/ui/GlassSurface");

    await render(
      withTheme(
        <GlassSurface>
          <Text>content</Text>
        </GlassSurface>,
      ),
    );

    expect(screen.getByTestId("glass-surface-solid")).toBeTruthy();
    expect(screen.queryByTestId("glass-surface-blur")).toBeNull();
    expect(screen.queryByTestId("glass-surface-liquid")).toBeNull();
    expect(screen.getByText("content")).toBeTruthy();
  });

  it("always renders its children", async () => {
    setLiquidGlass(false);
    const { GlassSurface } = require("@/components/ui/GlassSurface");

    await render(
      withTheme(
        <GlassSurface>
          <Text>children survive</Text>
        </GlassSurface>,
      ),
    );

    expect(screen.getByText("children survive")).toBeTruthy();
  });
});
