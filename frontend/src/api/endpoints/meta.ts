import { apiClient } from "../client";
import type { HealthResponse, MetaResponse, ReadyResponse } from "../types";

export async function getHealth(): Promise<HealthResponse> {
  const response = await apiClient.get<HealthResponse>("/health", {
    baseURL: apiClient.defaults.baseURL?.replace(/\/v1$/, ""),
  });
  return response.data;
}

export async function getReady(): Promise<ReadyResponse> {
  const response = await apiClient.get<ReadyResponse>("/ready", {
    baseURL: apiClient.defaults.baseURL?.replace(/\/v1$/, ""),
  });
  return response.data;
}

export async function getMeta(): Promise<MetaResponse> {
  const response = await apiClient.get<MetaResponse>("/meta");
  return response.data;
}
