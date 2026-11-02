import { File } from "expo-file-system";
import { SaveFormat, manipulateAsync } from "expo-image-manipulator";

export interface PreparedFile {
  filename: string;
  /** `file://` URI of the prepared image, ready to be appended to FormData */
  uri: string;
  mime: string;
  sizeBytes: number;
}

/** Contract 3.6 / Section 9.3: long edge <= 2048 px, JPEG quality ~0.85 */
export const MAX_LONG_EDGE = 2048;
export const JPEG_QUALITY = 0.85;

function fileSize(uri: string): number {
  try {
    return new File(uri).size ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Convert any picked image (including HEIC) to JPEG, resize so the long edge is
 * <= 2048 px and compress to ~0.85 quality.
 *
 * The result stays on disk as a `file://` URI: the upload helper appends it to
 * FormData as `{ uri, name, type }`, which is what React Native's FormData
 * expects. Nothing is stripped manually (the backend removes EXIF).
 *
 * When `maxBytes` is given and the result is still too large, the image is
 * re-encoded at a lower quality before giving up.
 */
export async function prepareImageForUpload(uri: string, maxBytes?: number): Promise<PreparedFile> {
  const filename = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;

  try {
    let result = await manipulateAsync(uri, [], {
      compress: JPEG_QUALITY,
      format: SaveFormat.JPEG,
    });

    if (result.width > MAX_LONG_EDGE || result.height > MAX_LONG_EDGE) {
      const scale = MAX_LONG_EDGE / Math.max(result.width, result.height);
      result = await manipulateAsync(
        result.uri,
        [
          {
            resize: {
              width: Math.round(result.width * scale),
              height: Math.round(result.height * scale),
            },
          },
        ],
        {
          compress: JPEG_QUALITY,
          format: SaveFormat.JPEG,
        },
      );
    }

    let sizeBytes = fileSize(result.uri);

    // Still too large: try a lower quality before reporting a local error.
    if (maxBytes && sizeBytes > maxBytes) {
      for (const quality of [0.6, 0.4, 0.25]) {
        result = await manipulateAsync(result.uri, [], {
          compress: quality,
          format: SaveFormat.JPEG,
        });
        sizeBytes = fileSize(result.uri);
        if (sizeBytes <= maxBytes) break;
      }
    }

    return { filename, uri: result.uri, mime: "image/jpeg", sizeBytes };
  } catch (err) {
    console.error("Failed to prepare image:", err);
    throw new Error("Failed to process image");
  }
}

export async function prepareImagesForUpload(
  uris: string[],
  maxBytes?: number,
): Promise<PreparedFile[]> {
  return Promise.all(uris.map((uri) => prepareImageForUpload(uri, maxBytes)));
}

/**
 * Convert image to base64 string (used for local previews only).
 */
export async function imageToBase64(uri: string): Promise<string> {
  try {
    const result = await manipulateAsync(uri, [], {
      compress: JPEG_QUALITY,
      format: SaveFormat.JPEG,
      base64: true,
    });
    return result.base64 || "";
  } catch (err) {
    console.error("Failed to convert image to base64:", err);
    throw new Error("Failed to convert image to base64");
  }
}

/**
 * Validate file size against limits
 */
export function validateFileSize(sizeBytes: number, maxBytes: number): boolean {
  return sizeBytes <= maxBytes;
}

/**
 * Get image dimensions without loading full image
 */
export async function getImageDimensions(
  uri: string,
): Promise<{ width: number; height: number } | null> {
  try {
    const result = await manipulateAsync(uri, [], {
      format: SaveFormat.JPEG,
    });
    return { width: result.width, height: result.height };
  } catch {
    return null;
  }
}
