import sharp from "sharp";
import { AppError } from "../lib/errors.ts";

export interface NormalizedImage {
  buffer: Uint8Array;
  mime: "image/jpeg";
  width: number;
  height: number;
}

export async function normalizeImage(
  input: Uint8Array,
  maxLongEdge = 2048,
  quality = 85,
): Promise<NormalizedImage> {
  try {
    const image = sharp(input);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new AppError("FILE_CORRUPT", { message: "Cannot decode image dimensions" });
    }

    // Decompression bomb protection: cap total pixels at 50 Megapixels
    if (metadata.width * metadata.height > 50_000_000) {
      throw new AppError("FILE_TOO_LARGE", {
        message: "Image pixel dimensions exceed maximum allowed limit (50 MP)",
      });
    }

    let pipeline = image.rotate(); // Auto-orient based on EXIF

    if (metadata.width > maxLongEdge || metadata.height > maxLongEdge) {
      pipeline = pipeline.resize({
        width: metadata.width >= metadata.height ? maxLongEdge : undefined,
        height: metadata.height > metadata.width ? maxLongEdge : undefined,
        fit: "inside",
        withoutEnlargement: true,
      });
    }

    // Strip EXIF metadata, convert to JPEG quality 85
    const outputBuffer = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();

    const outputMeta = await sharp(outputBuffer).metadata();

    return {
      buffer: new Uint8Array(outputBuffer),
      mime: "image/jpeg",
      width: outputMeta.width || metadata.width,
      height: outputMeta.height || metadata.height,
    };
  } catch (err: any) {
    if (err instanceof AppError) {
      throw err;
    }
    throw new AppError("FILE_CORRUPT", {
      message: `Failed to process image: ${err.message}`,
    });
  }
}
