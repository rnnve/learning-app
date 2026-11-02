import i18n from "@/i18n";
import { lightPaperTheme } from "@/theme/paperTheme";
/**
 * Material render flow (contract Section 9.7).
 *
 * A material opened after generation has to be rendered by its type:
 * summary, flashcards or quiz.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { PaperProvider } from "react-native-paper";

const mockGetMaterial = jest.fn();
const mockUpdateMaterial = jest.fn();
const mockDeleteMaterial = jest.fn();
const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockRouteParams = { id: "mat-1" };

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
  useRouter: () => ({
    back: jest.fn(),
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  }),
  useLocalSearchParams: () => mockRouteParams,
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

jest.mock("@/api/endpoints/materials", () => ({
  getMaterial: (...args: unknown[]) => mockGetMaterial(...args),
  updateMaterial: (...args: unknown[]) => mockUpdateMaterial(...args),
  deleteMaterial: (...args: unknown[]) => mockDeleteMaterial(...args),
}));

const MaterialScreen = require("../../app/material/[id]").default;

function makeSummaryMaterial() {
  return {
    id: "mat-1",
    type: "summary",
    sourceId: "src-1",
    title: "สรุปบทที่ 1",
    content: {
      overview: "เนื้อหาสรุปโดยย่อ",
      keyPoints: [{ text: "จุดสำคัญแรก", sourceRefs: [] }],
      sections: [],
      glossary: [],
      limitations: [],
    },
    options: { length: "medium" },
    isSaved: false,
    generatedBy: "ai",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function makeFlashcardsMaterial() {
  return {
    id: "mat-2",
    type: "flashcards",
    sourceId: "src-1",
    title: "แฟลชการ์ดบทที่ 1",
    content: {
      cards: [
        { id: "c1", front: "คำถาม A", back: "คำตอบ A", hint: "ใบ้", tags: [], sourceRefs: [] },
        { id: "c2", front: "คำถาม B", back: "คำตอบ B", hint: null, tags: [], sourceRefs: [] },
      ],
    },
    options: { count: 15 },
    isSaved: false,
    generatedBy: "ai",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function makeQuizMaterial() {
  return {
    id: "mat-3",
    type: "quiz",
    sourceId: "src-1",
    title: "แบบทดสอบบทที่ 1",
    content: {
      questions: [
        {
          id: "q1",
          type: "multiple_choice",
          prompt: "อะไรคือ...?",
          choices: [
            { id: "ch1", text: "ตอบ ก" },
            { id: "ch2", text: "ตอบ ข" },
          ],
          correctChoiceId: "ch2",
          acceptedAnswers: null,
          modelAnswer: null,
          explanation: "เพราะ...",
          sourceRefs: [],
        },
      ],
    },
    options: { count: 10 },
    isSaved: false,
    generatedBy: "ai",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function renderScreen(id: string) {
  mockRouteParams = { id };
  return render(
    <PaperProvider theme={lightPaperTheme}>
      <MaterialScreen />
    </PaperProvider>,
  );
}

describe("material render flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders a summary material after generation", async () => {
    mockGetMaterial.mockResolvedValue(makeSummaryMaterial());

    await renderScreen("mat-1");

    await waitFor(() => {
      expect(screen.getAllByText("สรุปบทที่ 1").length).toBeGreaterThan(0);
    });
    expect(screen.getByText(i18n.t("material.keyPoints"))).toBeTruthy();
    expect(screen.getByText("จุดสำคัญแรก")).toBeTruthy();
    expect(screen.getByText(i18n.t("enums.materialTypes.summary"))).toBeTruthy();
  });

  it("renders a flashcards material with cards", async () => {
    mockGetMaterial.mockResolvedValue(makeFlashcardsMaterial());

    await renderScreen("mat-2");

    await waitFor(() => {
      expect(screen.getAllByText("แฟลชการ์ดบทที่ 1").length).toBeGreaterThan(0);
    });
    expect(screen.getByText("Q: คำถาม A")).toBeTruthy();
    expect(screen.getByText("A: คำตอบ A")).toBeTruthy();
    expect(screen.getByText("Q: คำถาม B")).toBeTruthy();
    expect(screen.getByText(i18n.t("material.startStudy"))).toBeTruthy();
  });

  it("renders a quiz material with questions and the study action", async () => {
    mockGetMaterial.mockResolvedValue(makeQuizMaterial());

    await renderScreen("mat-3");

    await waitFor(() => {
      expect(screen.getAllByText("แบบทดสอบบทที่ 1").length).toBeGreaterThan(0);
    });
    expect(screen.getByText("1. อะไรคือ...?")).toBeTruthy();
    expect(screen.getByText("ตอบ ก")).toBeTruthy();
    expect(screen.getByText("ตอบ ข")).toBeTruthy();
    expect(screen.getByText(i18n.t("material.startQuiz"))).toBeTruthy();
  });

  it("shows a retryable error when the material cannot be loaded", async () => {
    mockGetMaterial.mockRejectedValue(new Error("not found"));

    await renderScreen("mat-x");

    await waitFor(() => {
      expect(screen.getByText(i18n.t("common.retry"))).toBeTruthy();
    });
  });
});
