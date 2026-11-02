/**
 * Image preparation tests (contract Section 13 / 9.3):
 *  - converts any picked image to JPEG
 *  - keeps the long edge <= 2048 px
 *  - reports the resulting size
 *  - re-compresses when the result is still over the limit
 */

jest.mock("expo-image-manipulator", () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: "jpeg", PNG: "png" },
}));

jest.mock("expo-file-system", () => ({
  File: jest.fn(),
}));

import {
  getImageDimensions,
  imageToBase64,
  prepareImageForUpload,
  prepareImagesForUpload,
  validateFileSize,
} from "@/lib/imageUtils";
import { File } from "expo-file-system";
import { manipulateAsync } from "expo-image-manipulator";

const mockManipulateAsync = manipulateAsync as unknown as jest.Mock;

/** Size reported by the (mocked) file system for the prepared file. */
let mockFileSize = 1024;

describe("imageUtils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFileSize = 1024;
    (File as unknown as jest.Mock).mockImplementation((uri: string) => ({
      uri,
      get size() {
        return mockFileSize;
      },
    }));
  });

  describe("validateFileSize", () => {
    it("returns true for a file under the limit", () => {
      expect(validateFileSize(1024, 2048)).toBe(true);
    });

    it("returns false for an oversized file", () => {
      expect(validateFileSize(2048, 1024)).toBe(false);
    });

    it("returns true for a file of exactly the limit size", () => {
      expect(validateFileSize(1024, 1024)).toBe(true);
    });
  });

  describe("getImageDimensions", () => {
    it("returns the dimensions of the image", async () => {
      mockManipulateAsync.mockResolvedValue({
        uri: "file://out.jpg",
        width: 1920,
        height: 1080,
        base64: "",
      });

      await expect(getImageDimensions("file://test.jpg")).resolves.toEqual({
        width: 1920,
        height: 1080,
      });
    });

    it("returns null when the image cannot be read", async () => {
      mockManipulateAsync.mockRejectedValue(new Error("Failed"));

      await expect(getImageDimensions("file://test.jpg")).resolves.toBeNull();
    });
  });

  describe("prepareImageForUpload", () => {
    it("returns a file:// URI, a JPEG mime type and the size", async () => {
      mockManipulateAsync.mockResolvedValue({
        uri: "file:///cache/out.jpg",
        width: 1000,
        height: 800,
        base64: "",
      });

      const result = await prepareImageForUpload("file:///tmp/heic.heic");

      expect(result.mime).toBe("image/jpeg");
      expect(result.uri).toBe("file:///cache/out.jpg");
      expect(result.sizeBytes).toBe(1024);
      expect(result.filename).toMatch(/^photo_\d+_[a-z0-9]+\.jpg$/);
      // The source is re-encoded as JPEG (this is what converts HEIC).
      expect(mockManipulateAsync).toHaveBeenCalledWith(
        "file:///tmp/heic.heic",
        [],
        expect.objectContaining({ format: "jpeg" }),
      );
    });

    it("resizes when the long edge is larger than 2048 px", async () => {
      mockManipulateAsync
        .mockResolvedValueOnce({
          uri: "file:///cache/step1.jpg",
          width: 3000,
          height: 2000,
          base64: "",
        })
        .mockResolvedValueOnce({
          uri: "file:///cache/step2.jpg",
          width: 2048,
          height: 1365,
          base64: "",
        });

      const result = await prepareImageForUpload("file:///tmp/big.jpg");

      expect(mockManipulateAsync).toHaveBeenCalledTimes(2);
      expect(mockManipulateAsync.mock.calls[1][1]).toEqual([
        { resize: { width: 2048, height: 1365 } },
      ]);
      expect(result.uri).toBe("file:///cache/step2.jpg");
    });

    it("does not resize when the image is already small enough", async () => {
      mockManipulateAsync.mockResolvedValue({
        uri: "file:///cache/small.jpg",
        width: 800,
        height: 600,
        base64: "",
      });

      await prepareImageForUpload("file:///tmp/small.jpg");

      expect(mockManipulateAsync).toHaveBeenCalledTimes(1);
    });

    it("re-compresses at a lower quality when the file is still too large", async () => {
      let calls = 0;
      mockManipulateAsync.mockImplementation(async () => {
        calls += 1;
        // Only a re-compression makes the file smaller.
        if (calls > 1) {
          mockFileSize = 500_000;
        }
        return { uri: "file:///cache/out.jpg", width: 100, height: 100, base64: "" };
      });
      mockFileSize = 5_000_000;

      const result = await prepareImageForUpload("file:///tmp/big.jpg", 1_000_000);

      expect(result.sizeBytes).toBeLessThanOrEqual(1_000_000);
      // initial encode + at least one lower-quality re-encode
      expect(mockManipulateAsync.mock.calls.length).toBeGreaterThan(1);
      const qualities = mockManipulateAsync.mock.calls.map((call) => call[2]?.compress);
      expect(qualities[0]).toBe(0.85);
      expect(qualities.some((q: number) => q < 0.85)).toBe(true);
    });

    it("throws a readable error when the image cannot be processed", async () => {
      mockManipulateAsync.mockRejectedValue(new Error("boom"));

      await expect(prepareImageForUpload("file:///test.jpg")).rejects.toThrow(
        "Failed to process image",
      );
    });
  });

  describe("prepareImagesForUpload", () => {
    it("prepares every image of the source", async () => {
      mockManipulateAsync.mockImplementation(async (uri: string) => ({
        uri: `${uri}.jpg`,
        width: 500,
        height: 500,
        base64: "",
      }));

      const files = await prepareImagesForUpload(["file:///a.jpg", "file:///b.jpg"]);

      expect(files).toHaveLength(2);
      expect(files[0].uri).toBe("file:///a.jpg.jpg");
      expect(files[1].uri).toBe("file:///b.jpg.jpg");
    });
  });

  describe("imageToBase64", () => {
    it("returns the base64 payload", async () => {
      mockManipulateAsync.mockResolvedValue({
        uri: "file:///cache/out.jpg",
        width: 100,
        height: 100,
        base64: "aGVsbG8=",
      });

      await expect(imageToBase64("file:///tmp/a.jpg")).resolves.toBe("aGVsbG8=");
      expect(mockManipulateAsync).toHaveBeenCalledWith(
        "file:///tmp/a.jpg",
        [],
        expect.objectContaining({ base64: true }),
      );
    });

    it("throws a readable error when the conversion fails", async () => {
      mockManipulateAsync.mockRejectedValue(new Error("boom"));

      await expect(imageToBase64("file:///tmp/a.jpg")).rejects.toThrow(
        "Failed to convert image to base64",
      );
    });
  });
});
