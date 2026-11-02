import i18n from "@/i18n";
import { lightPaperTheme } from "@/theme/paperTheme";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { PaperProvider } from "react-native-paper";

const mockCreateSource = jest.fn();
const mockPickDocument = jest.fn();
const mockPush = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock("@/api/endpoints/home", () => ({ getMeta: jest.fn().mockResolvedValue({ limits: {} }) }));
jest.mock("@/api/endpoints/sources", () => ({
  createSource: (...args: unknown[]) => mockCreateSource(...args),
}));
jest.mock("expo-document-picker", () => ({
  getDocumentAsync: (...args: unknown[]) => mockPickDocument(...args),
}));
jest.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: "Images" },
}));
jest.mock("expo-router", () => ({
  router: { push: (...args: unknown[]) => mockPush(...args), back: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));

const ImportScreen = require("../../app/import").default;
const CaptureReviewScreen = require("../../app/capture-review").default;

describe("source upload flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = {};
    mockCreateSource.mockResolvedValue({ source: { id: "source-1" }, job: { id: "job-1" } });
  });

  it.each([
    ["notes.pdf", "application/pdf"],
    ["notes.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ["notes.txt", "text/plain"],
  ])("uploads %s directly from the picked file URI", async (name, mimeType) => {
    const uri = `file:///cache/${name}`;
    mockPickDocument.mockResolvedValue({
      canceled: false,
      assets: [{ uri, name, mimeType, size: 1234 }],
    });
    // Native Blob has no arrayBuffer(): uploading must not read through fetch/blob.
    const fetchSpy = jest
      .spyOn(global, "fetch")
      .mockResolvedValue({ blob: async () => ({}) } as Response);
    try {
      await render(
        <PaperProvider theme={lightPaperTheme}>
          <ImportScreen />
        </PaperProvider>,
      );
      await fireEvent.press(screen.getByText(i18n.t("common.none")));
      await waitFor(() => expect(screen.getAllByText(name).length).toBeGreaterThan(0));
      await fireEvent.press(screen.getByRole("button", { name: i18n.t("review.submit") }));
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/source/source-1"));
      expect(mockCreateSource).toHaveBeenCalledWith(
        expect.objectContaining({
          files: [{ filename: name, uri, mime: mimeType, sizeBytes: 1234 }],
        }),
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("loads camera photos from Expo Router params and uploads them", async () => {
    mockParams = { photos: JSON.stringify(["file:///camera/page.jpg"]) };
    await render(
      <PaperProvider theme={lightPaperTheme}>
        <CaptureReviewScreen />
      </PaperProvider>,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: i18n.t("review.submit") })).toBeEnabled(),
    );
    await fireEvent.press(screen.getByRole("button", { name: i18n.t("review.submit") }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/source/source-1"));
    expect(mockCreateSource.mock.calls[0][0].files[0].uri).toBe("file:///mock/prepared.jpg");
  });
});
