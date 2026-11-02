import { apiClient } from "../client";
import type { HomeResponse, MetaResponse } from "../types";

export async function getHome(): Promise<HomeResponse> {
  const response = await apiClient.get<HomeResponse>("/home");
  return response.data;
}

export async function getMeta(): Promise<MetaResponse> {
  const response = await apiClient.get<MetaResponse>("/meta");
  return response.data;
}
