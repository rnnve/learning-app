export interface StorageProvider {
  saveFile(key: string, data: Uint8Array): Promise<void>;
  getFile(key: string): Promise<Uint8Array>;
  deleteFile(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getFilePath?(key: string): string;
}
