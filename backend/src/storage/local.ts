import { existsSync, mkdirSync } from "node:fs";
import { rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { env } from "../config/env.ts";
import type { StorageProvider } from "./types.ts";

export class LocalDiskStorage implements StorageProvider {
  private baseDir: string;

  constructor(baseDir: string = env.STORAGE_DIR) {
    this.baseDir = baseDir;
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true });
    }
  }

  public getFilePath(key: string): string {
    // Prevent path traversal
    const safeKey = key.replace(/\.\./g, "").replace(/^\/+/, "");
    return join(this.baseDir, safeKey);
  }

  public async saveFile(key: string, data: Uint8Array): Promise<void> {
    const fullPath = this.getFilePath(key);
    const dir = dirname(fullPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    await Bun.write(fullPath, data);
  }

  public async getFile(key: string): Promise<Uint8Array> {
    const fullPath = this.getFilePath(key);
    const file = Bun.file(fullPath);
    if (!(await file.exists())) {
      throw new Error(`File not found at storage key: ${key}`);
    }
    return new Uint8Array(await file.arrayBuffer());
  }

  public async deleteFile(key: string): Promise<void> {
    const fullPath = this.getFilePath(key);
    const file = Bun.file(fullPath);
    if (await file.exists()) {
      await rm(fullPath, { force: true });
    }
  }

  public async deletePrefix(prefix: string): Promise<void> {
    const fullPath = this.getFilePath(prefix);
    if (existsSync(fullPath)) {
      await rm(fullPath, { recursive: true, force: true });
    }
  }

  public async exists(key: string): Promise<boolean> {
    const fullPath = this.getFilePath(key);
    return await Bun.file(fullPath).exists();
  }
}

export const storage = new LocalDiskStorage();
