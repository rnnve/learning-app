import { Banner } from "@/components/ui/Banner";
import { ErrorState } from "@/components/ui/ErrorState";
import { ProgressSteps } from "@/components/ui/ProgressSteps";
import i18n from "@/i18n";
import { lightPaperTheme } from "@/theme/paperTheme";
/**
 * Component tests for the shared UI kit (contract Section 13):
 *  - ProgressSteps renders the stage list and the progress
 *  - ErrorState shows the localized message and a working Retry
 *  - Banner renders the fixture variant distinctly
 */
import { fireEvent, render, screen } from "@testing-library/react-native";
import type React from "react";
import { PaperProvider } from "react-native-paper";

function withTheme(node: React.ReactElement) {
  return <PaperProvider theme={lightPaperTheme}>{node}</PaperProvider>;
}

describe("ProgressSteps", () => {
  it("renders the progress percentage and the page detail", async () => {
    await render(
      withTheme(
        <ProgressSteps
          stage="extracting_text"
          progress={42}
          detail={{ page: 3, pagesTotal: 10 }}
        />,
      ),
    );

    expect(screen.getByText("42%")).toBeTruthy();
    expect(screen.getByText("3/10")).toBeTruthy();
  });

  it("renders every stage of the source pipeline with a label", async () => {
    await render(withTheme(<ProgressSteps stage="ocr" progress={10} />));

    for (const stage of [
      "validating",
      "normalizing_images",
      "extracting_text",
      "ocr",
      "chunking",
      "finalizing",
    ]) {
      const label = i18n.t(`enums.stages.${stage}`);
      expect(screen.getByText(label)).toBeTruthy();
      // The label is localized, the raw stage name is never shown.
      expect(label).not.toBe(stage);
    }
  });

  it("renders the generation stages for a generate job", async () => {
    await render(withTheme(<ProgressSteps stage="generating" progress={50} type="generate" />));

    for (const stage of ["preparing_context", "generating", "validating_output", "saving"]) {
      expect(screen.getByText(i18n.t(`enums.stages.${stage}`))).toBeTruthy();
    }
  });

  it("exposes the progress to accessibility services", async () => {
    await render(withTheme(<ProgressSteps stage="ocr" progress={75} />));

    const bar = screen.getByRole("progressbar");
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 75 });
  });

  it("marks finished stages with a check mark", async () => {
    await render(withTheme(<ProgressSteps stage="ocr" progress={10} />));

    const checks = screen.getAllByText("✓");
    expect(checks.length).toBeGreaterThan(0);
  });
});

describe("ErrorState", () => {
  it("shows the localized message of an ApiError instance", async () => {
    const { ApiError } = require("@/api/errors");
    const err = new ApiError({
      status: 403,
      code: "CONSENT_REQUIRED",
      message: "raw backend message",
      retryable: false,
    });

    await render(withTheme(<ErrorState error={err} />));

    expect(screen.getByText(err.getLocalizedMessage())).toBeTruthy();
    expect(screen.queryByText("raw backend message")).toBeNull();
  });

  it("shows the message of a plain Error", async () => {
    await render(withTheme(<ErrorState error={new Error("something broke")} />));
    expect(screen.getByText("something broke")).toBeTruthy();
  });

  it("falls back to the generic message for an unknown error", async () => {
    await render(withTheme(<ErrorState error={"a string"} />));
    expect(screen.getByText(i18n.t("errors.GENERIC_FALLBACK"))).toBeTruthy();
  });

  it("renders a Retry button that calls onRetry", async () => {
    const onRetry = jest.fn();
    await render(withTheme(<ErrorState error={new Error("boom")} onRetry={onRetry} />));

    const retry = screen.getByLabelText(i18n.t("common.retry"));
    await fireEvent.press(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("hides the Retry button when no handler is given", async () => {
    await render(withTheme(<ErrorState error={new Error("boom")} />));
    expect(screen.queryByLabelText(i18n.t("common.retry"))).toBeNull();
  });

  it("prefers an explicit message over the error", async () => {
    await render(
      withTheme(<ErrorState error={new Error("boom")} message={i18n.t("errors.RATE_LIMITED")} />),
    );

    expect(screen.getByText(i18n.t("errors.RATE_LIMITED"))).toBeTruthy();
    expect(screen.queryByText("boom")).toBeNull();
  });
});

describe("Banner", () => {
  it("renders the message", async () => {
    await render(withTheme(<Banner message="ตัวอย่างข้อมูล" />));
    expect(screen.getByText("ตัวอย่างข้อมูล")).toBeTruthy();
  });

  it("renders the fixture variant with its own colours", async () => {
    await render(withTheme(<Banner message="fixture data" variant="fixture" />));

    expect(screen.getByRole("alert")).toHaveStyle({ backgroundColor: "#FEF3C7" });
  });

  it("renders the error variant with the error colours", async () => {
    await render(withTheme(<Banner message="bad" variant="error" />));

    expect(screen.getByRole("alert")).toHaveStyle({ borderColor: lightPaperTheme.colors.error });
  });

  it("renders the info variant with the primary colours", async () => {
    await render(withTheme(<Banner message="info" />));

    const banner = screen.getByRole("alert");
    expect(banner).toHaveStyle({ borderColor: lightPaperTheme.colors.primary });
  });
});
