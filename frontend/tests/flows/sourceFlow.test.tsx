import i18n from "@/i18n";
import { lightPaperTheme } from "@/theme/paperTheme";
/**
 * Source processing / preview flow (contract Section 9.4 + 9.5).
 *
 * The screen has to render the processing progress while the extraction job
 * runs and the three terminal states of the source: ready, partial and failed.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { PaperProvider } from "react-native-paper";

const mockGetSource = jest.fn();
const mockRetrySource = jest.fn();
const mockDeleteSource = jest.fn();
const mockGetSourceText = jest.fn();
const mockUseJob = jest.fn();

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: "src-1" }),
}));

jest.mock("@/auth/AuthProvider", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: {
      id: "user-1",
      displayName: "ทดสอบ",
      isGuest: true,
      preferences: {},
      consent: { aiProcessing: true, version: "2026-10-v1", acceptedAt: null },
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  }),
}));

jest.mock("@/api/endpoints/sources", () => ({
  getSource: (...args: unknown[]) => mockGetSource(...args),
  retrySource: (...args: unknown[]) => mockRetrySource(...args),
  deleteSource: (...args: unknown[]) => mockDeleteSource(...args),
  getSourceText: (...args: unknown[]) => mockGetSourceText(...args),
}));

jest.mock("@/features/sources/useJob", () => ({
  useJob: (...args: unknown[]) => mockUseJob(...args),
}));

jest.mock("@/api/client", () => ({
  authHeaders: () => ({}),
  sourceFileUrl: (id: string, page: number) => `https://api.test/v1/sources/${id}/file/${page}`,
}));

jest.mock("expo-image", () => {
  const { View } = require("react-native");
  return { Image: View };
});

const SourceScreen = require("../../app/source/[id]").default;

function makeSource(overrides: Record<string, unknown> = {}) {
  return {
    id: "src-1",
    title: "ชีทสรุปบทที่ 1",
    kind: "images",
    originalFilenames: ["page-1.jpg"],
    sizeBytes: 1024,
    pageCount: 2,
    fileCount: 1,
    language: "th",
    charCount: 1200,
    status: "processing",
    extraction: {
      method: "vision_ocr",
      quality: null,
      pagesTotal: 2,
      pagesExtracted: 0,
      pagesFailed: [],
      warnings: [],
    },
    error: null,
    jobId: "job-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function renderScreen() {
  return render(
    <PaperProvider theme={lightPaperTheme}>
      <SourceScreen />
    </PaperProvider>,
  );
}

describe("source processing and preview flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseJob.mockReturnValue({
      job: {
        id: "job-1",
        status: "running",
        stage: "ocr",
        progress: 45,
        detail: { page: 1, pagesTotal: 2 },
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
      isTerminal: false,
    });
  });

  it("shows the live processing progress while the job runs", async () => {
    mockGetSource.mockResolvedValue(makeSource());

    await renderScreen();

    await waitFor(() => {
      expect(screen.getByText("45%")).toBeTruthy();
    });
    expect(screen.getByRole("progressbar")).toBeTruthy();
    // The stage of the running job is highlighted.
    expect(screen.getByText(i18n.t("enums.stages.ocr"))).toBeTruthy();
    // No generation actions while the extraction is still running.
    expect(screen.queryByText(i18n.t("source.generateSummary"))).toBeNull();
  });

  it("shows the extraction result and the generation actions for a ready source", async () => {
    mockGetSource.mockResolvedValue(
      makeSource({
        status: "ready",
        charCount: 1200,
        extraction: {
          method: "vision_ocr",
          quality: "good",
          pagesTotal: 2,
          pagesExtracted: 2,
          pagesFailed: [],
          warnings: [],
        },
      }),
    );

    await renderScreen();

    await waitFor(() => {
      expect(screen.getByText(i18n.t("source.extractionSuccess"))).toBeTruthy();
    });
    expect(screen.getByText(i18n.t("enums.extractionQuality.good"))).toBeTruthy();
    expect(screen.getByText(i18n.t("source.generateSummary"))).toBeTruthy();
    expect(screen.getByText(i18n.t("source.generateFlashcards"))).toBeTruthy();
    expect(screen.getByText(i18n.t("source.generateQuiz"))).toBeTruthy();
  });

  it("warns about partially readable pages for a partial source", async () => {
    mockGetSource.mockResolvedValue(
      makeSource({
        status: "partial",
        extraction: {
          method: "vision_ocr",
          quality: "fair",
          pagesTotal: 3,
          pagesExtracted: 2,
          pagesFailed: [3],
          warnings: [{ code: "LOW_CONTRAST", message: "low contrast", page: 2 }],
        },
      }),
    );

    await renderScreen();

    await waitFor(() => {
      expect(screen.getByText(i18n.t("source.extractionPartial"))).toBeTruthy();
    });
    expect(screen.getByText(i18n.t("source.partialNotice"))).toBeTruthy();
    // The warning label is rendered together with the page number.
    expect(
      screen.getByText(
        new RegExp(i18n.t("enums.warnings.LOW_CONTRAST").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      ),
    ).toBeTruthy();
    expect(screen.getByText(i18n.t("enums.extractionQuality.fair"))).toBeTruthy();
  });

  it("shows the failure and lets the user retry the extraction", async () => {
    mockGetSource.mockResolvedValue(
      makeSource({
        status: "failed",
        error: { code: "EXTRACTION_FAILED", message: "OCR blew up" },
      }),
    );
    mockRetrySource.mockResolvedValue({
      source: makeSource({ status: "processing" }),
      job: { id: "job-2", status: "running", stage: "validating", progress: 0 },
    });

    await renderScreen();

    await waitFor(() => {
      expect(screen.getByText(i18n.t("source.extractionFailed"))).toBeTruthy();
    });
    expect(screen.getByText(i18n.t("errors.EXTRACTION_FAILED"))).toBeTruthy();

    await fireEvent.press(screen.getByText(i18n.t("source.retryProcessing")));

    await waitFor(() => {
      expect(mockRetrySource).toHaveBeenCalledWith("src-1");
    });
  });

  it("shows a retryable error state when the source cannot be loaded", async () => {
    mockGetSource.mockRejectedValue(new Error("network down"));

    await renderScreen();

    await waitFor(() => {
      expect(screen.getByText(i18n.t("common.retry"))).toBeTruthy();
    });
  });
});
