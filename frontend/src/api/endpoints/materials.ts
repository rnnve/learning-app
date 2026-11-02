import { apiClient } from "../client";
import type {
  ContentLanguage,
  Difficulty,
  FlashcardProgressItem,
  Job,
  Level,
  Material,
  MaterialSummary,
  MaterialType,
  PaginatedResult,
  QuestionType,
} from "../types";

export interface CreateMaterialParams {
  type: MaterialType;
  sourceId: string;
  title?: string;
  idempotencyKey: string;
  options?: {
    language?: ContentLanguage;
    level?: Level | "auto";
    pageRange?: { from: number; to: number } | null;
    length?: "short" | "medium" | "detailed";
    count?: number;
    difficulty?: Difficulty;
    questionTypes?: QuestionType[];
  };
}

export async function createMaterial(params: CreateMaterialParams): Promise<{ job: Job }> {
  const { idempotencyKey, ...body } = params;
  const response = await apiClient.post<{ job: Job }>("/materials", body, {
    headers: {
      "Idempotency-Key": idempotencyKey,
    },
  });
  return response.data;
}

export async function getMaterials(params?: {
  type?: MaterialType;
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

export async function getMaterial(id: string): Promise<Material> {
  const response = await apiClient.get<Material>(`/materials/${id}`);
  return response.data;
}

export async function updateMaterial(
  id: string,
  params: { title?: string; isSaved?: boolean },
): Promise<Material> {
  const response = await apiClient.patch<Material>(`/materials/${id}`, params);
  return response.data;
}

export async function deleteMaterial(id: string): Promise<void> {
  await apiClient.delete(`/materials/${id}`);
}

export async function getFlashcardProgress(
  id: string,
): Promise<{ items: FlashcardProgressItem[] }> {
  const response = await apiClient.get<{ items: FlashcardProgressItem[] }>(
    `/materials/${id}/flashcard-progress`,
  );
  return response.data;
}
