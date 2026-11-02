import type { PreparedFile } from "@/lib/imageUtils";
import { apiClient } from "../client";
import type { Job, PaginatedResult, Source, SourceChunk, SourceKind, SourceStatus } from "../types";

export interface CreateSourceParams {
  files: PreparedFile[];
  title?: string;
  language?: "th" | "en";
  idempotencyKey: string;
  onUploadProgress?: (progressEvent: { loaded: number; total?: number }) => void;
  signal?: AbortSignal;
}

export async function createSource(
  params: CreateSourceParams,
): Promise<{ source: Source; job: Job }> {
  const formData = new FormData();

  for (const file of params.files) {
    // React Native's FormData expects `{ uri, name, type }` file parts.
    // The runtime adds the multipart boundary, so we must NOT set
    // Content-Type ourselves (Section 7 of the contract).
    formData.append("files", {
      uri: file.uri,
      name: file.filename,
      type: file.mime,
    } as unknown as Blob);
  }

  if (params.title) {
    formData.append("title", params.title);
  }

  if (params.language) {
    formData.append("language", params.language);
  }

  const response = await apiClient.post<{ source: Source; job: Job }>("/sources", formData, {
    headers: {
      // Clear the API client's JSON default so native networking adds the multipart boundary.
      "Content-Type": undefined,
      "Idempotency-Key": params.idempotencyKey,
    },
    timeout: 180000,
    signal: params.signal,
    onUploadProgress: (progressEvent) => {
      if (params.onUploadProgress) {
        params.onUploadProgress({
          loaded: progressEvent.loaded,
          total: progressEvent.total,
        });
      }
    },
  });

  return response.data;
}

export async function getSources(params?: {
  status?: SourceStatus;
  kind?: SourceKind;
  q?: string;
  limit?: number;
  cursor?: string;
}): Promise<PaginatedResult<Source>> {
  const response = await apiClient.get<PaginatedResult<Source>>("/sources", {
    params,
  });
  return response.data;
}

export async function getSource(id: string): Promise<Source> {
  const response = await apiClient.get<Source>(`/sources/${id}`);
  return response.data;
}

export async function updateSource(id: string, params: { title: string }): Promise<Source> {
  const response = await apiClient.patch<Source>(`/sources/${id}`, params);
  return response.data;
}

export async function getSourceText(
  id: string,
  params?: { limit?: number; cursor?: string },
): Promise<PaginatedResult<SourceChunk>> {
  const response = await apiClient.get<PaginatedResult<SourceChunk>>(`/sources/${id}/text`, {
    params,
  });
  return response.data;
}

export async function retrySource(id: string): Promise<{ source: Source; job: Job }> {
  const response = await apiClient.post<{ source: Source; job: Job }>(`/sources/${id}/retry`);
  return response.data;
}

export async function deleteSource(id: string, keepMaterials = false): Promise<void> {
  await apiClient.delete(`/sources/${id}`, {
    params: { keepMaterials },
  });
}
