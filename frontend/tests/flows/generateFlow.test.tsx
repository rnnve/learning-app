import i18n from "@/i18n";
import { lightPaperTheme } from "@/theme/paperTheme";
/**
 * Generate -> material flow (contract Section 9.6 + 9.7 + Section 13).
 *
 * The generation is started with an Idempotency-Key (UUID), the job is polled
 * and the material is opened as soon as the job succeeded.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { PaperProvider } from "react-native-paper";

const mockGetSource = jest.fn();
const mockCreateMaterial = jest.fn();
const mockUseJob = jest.fn();
const mockReplace = jest.fn();
let mockRouteParams = { id: "src-1", type: "summary" };

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => mockRouteParams,
}));

jest.mock("@/auth/AuthProvider", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: {
      id: "user-1",
      displayName: "ทดสอบ",
      isGuest: true,
      preferences: { uiLanguage: "th", contentLanguage: "auto", level: "general" },
      consent: { aiProcessing: true, version: "2026-10-v1", acceptedAt: null },
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  }),
}));

jest.mock("@/api/endpoints/sources", () => ({
  getSource: (...args: unknown[]) => mockGetSource(...args),
}));

jest.mock("@/api/endpoints/materials", () => ({
  createMaterial: (...args: unknown[]) => mockCreateMaterial(...args),
}));

jest.mock("@/features/sources/useJob", () => ({
  useJob: (...args: unknown[]) => mockUseJob(...args),
}));

const GenerateScreen = require("../../app/source/[id]/generate").default;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const source = {
  id: "src-1",
  title: "ชีทสรุปบทที่ 1",
  kind: "images",
  originalFilenames: ["page-1.jpg"],
  sizeBytes: 1024,
  pageCount: 3,
  fileCount: 1,
  language: "th",
  charCount: 1200,
  status: "ready",
  extraction: {
    method: "vision_ocr",
    quality: "good",
    pagesTotal: 3,
    pagesExtracted: 3,
    pagesFailed: [],
    warnings: [],
  },
  error: null,
  jobId: "job-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function renderScreen(type: "summary" | "flashcards" | "quiz") {
  mockRouteParams = { id: "src-1", type };
  return render(
    <PaperProvider theme={lightPaperTheme}>
      <GenerateScreen />
    </PaperProvider>,
  );
}

/** The job that the (mocked) poller returns. */
let mockJob: unknown = null;
let mockJobError: any = null;
let mockIsJobError = false;

describe("generate flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockJob = null;
    mockJobError = null;
    mockIsJobError = false;
    mockGetSource.mockResolvedValue(source);
    mockUseJob.mockImplementation(() => ({
      job: mockJob,
      isLoading: false,
      isError: mockIsJobError,
      error: mockJobError,
      refetch: jest.fn(),
      isTerminal: mockJob !== null || mockIsJobError,
    }));
  });

  it("starts a summary generation with a UUID idempotency key", async () => {
    mockCreateMaterial.mockResolvedValue({ job: { id: "job-2", status: "queued" } });

    await renderScreen("summary");
    await waitFor(() => expect(screen.getByTestId("generate-submit")).toBeTruthy());

    await fireEvent.press(screen.getByTestId("generate-submit"));

    await waitFor(() => {
      expect(mockCreateMaterial).toHaveBeenCalledTimes(1);
    });
    const payload = mockCreateMaterial.mock.calls[0][0];
    expect(payload.type).toBe("summary");
    expect(payload.sourceId).toBe("src-1");
    expect(payload.idempotencyKey).toMatch(UUID_PATTERN);
    expect(payload.options.length).toBe("medium");
  });

  it("starts a flashcard generation with the card count", async () => {
    mockCreateMaterial.mockResolvedValue({ job: { id: "job-2", status: "queued" } });

    await renderScreen("flashcards");
    await waitFor(() => expect(screen.getByTestId("generate-submit")).toBeTruthy());

    await fireEvent.press(screen.getByTestId("generate-submit"));

    await waitFor(() => {
      expect(mockCreateMaterial).toHaveBeenCalledTimes(1);
    });
    const payload = mockCreateMaterial.mock.calls[0][0];
    expect(payload.type).toBe("flashcards");
    expect(payload.options.count).toBe(15);
    expect(payload.idempotencyKey).toMatch(UUID_PATTERN);
  });

  it("starts a quiz generation with the question options", async () => {
    mockCreateMaterial.mockResolvedValue({ job: { id: "job-2", status: "queued" } });

    await renderScreen("quiz");
    await waitFor(() => expect(screen.getByTestId("generate-submit")).toBeTruthy());

    await fireEvent.press(screen.getByTestId("generate-submit"));

    await waitFor(() => {
      expect(mockCreateMaterial).toHaveBeenCalledTimes(1);
    });
    const payload = mockCreateMaterial.mock.calls[0][0];
    expect(payload.type).toBe("quiz");
    expect(payload.options.count).toBe(10);
    expect(payload.options.difficulty).toBe("mixed");
    expect(payload.options.questionTypes).toEqual([
      "multiple_choice",
      "true_false",
      "short_answer",
    ]);
  });

  it("opens the material once the generation job succeeded", async () => {
    mockCreateMaterial.mockImplementation(async () => {
      mockJob = {
        id: "job-2",
        status: "succeeded",
        stage: "saving",
        progress: 100,
        result: { materialId: "mat-1" },
      };
      return { job: { id: "job-2", status: "queued" } };
    });

    await renderScreen("summary");
    await waitFor(() => expect(screen.getByTestId("generate-submit")).toBeTruthy());

    await fireEvent.press(screen.getByTestId("generate-submit"));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/material/mat-1");
    });
  });

  it("shows the error code of a failed generation job", async () => {
    mockCreateMaterial.mockImplementation(async () => {
      mockJob = {
        id: "job-2",
        status: "failed",
        stage: "generating",
        progress: 30,
        error: { code: "AI_TIMEOUT", message: "provider down" },
      };
      mockJobError = {
        code: "AI_TIMEOUT",
        getLocalizedMessage: () => i18n.t("errors.AI_TIMEOUT"),
      };
      mockIsJobError = true;
      return { job: { id: "job-2", status: "queued" } };
    });

    await renderScreen("summary");
    await waitFor(() => expect(screen.getByTestId("generate-submit")).toBeTruthy());

    await fireEvent.press(screen.getByTestId("generate-submit"));

    await waitFor(() => {
      expect(screen.getByText(i18n.t("errors.AI_TIMEOUT"))).toBeTruthy();
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
