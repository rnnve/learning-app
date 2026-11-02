import { apiClient } from "../client";
import type { MaterialSummary, PaginatedResult, Source } from "../types";

export async function getSources(params?: {
  status?: string;
  kind?: string;
  q?: string;
  limit?: number;
  cursor?: string;
}): Promise<PaginatedResult<Source>> {
  const response = await apiClient.get<PaginatedResult<Source>>("/sources", {
    params,
  });
  return response.data;
}

export async function getMaterials(params?: {
  type?: string;
  sourceId?: string;
  saved?: boolean;
  q?: string;
  limit?: number;
  cursor?: string;
}): Promise<PaginatedResult<MaterialSummary>> {
  const response = await apiClient.get<PaginatedResult<MaterialSummary>>("/materials", {
    params,
  });
  return response.data;
}

export async function deleteSource(id: string, keepMaterials = false): Promise<void> {
  await apiClient.delete(`/sources/${id}`, {
    params: { keepMaterials },
  });
}

export async function deleteMaterial(id: string): Promise<void> {
  await apiClient.delete(`/materials/${id}`);
}
