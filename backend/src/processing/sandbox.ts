import { existsSync, mkdirSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AppError } from "../lib/errors.ts";

export async function runInSandbox<T>(
  jobId: string,
  timeoutMs: number,
  task: (tempDir: string) => Promise<T>,
): Promise<T> {
  const tempDir = join(tmpdir(), "thaistudy-sandbox", jobId);
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }

  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      reject(new AppError("AI_TIMEOUT", { message: "Sandbox execution timed out" }));
    }, timeoutMs);
    // Unref so process can exit if needed
    if (typeof timer.unref === "function") {
      timer.unref();
    }
  });

  try {
    return await Promise.race([task(tempDir), timeoutPromise]);
  } catch (err: any) {
    if (err instanceof AppError) {
      throw err;
    }
    throw new AppError("EXTRACTION_FAILED", {
      message: `Sandbox execution failed: ${err.message}`,
    });
  } finally {
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  }
}
