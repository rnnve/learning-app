import { apiClient } from "../client";
import type { Preferences, User } from "../types";

export async function getMe(): Promise<User> {
  const response = await apiClient.get<User>("/me");
  return response.data;
}

export async function updateMe(params: {
  displayName?: string;
  preferences?: Partial<Preferences>;
}): Promise<User> {
  const response = await apiClient.patch<User>("/me", params);
  return response.data;
}

export async function updateConsent(params: {
  aiProcessing: boolean;
  version: string;
}): Promise<User> {
  const response = await apiClient.put<User>("/me/consent", params);
  return response.data;
}

export async function deleteMe(): Promise<void> {
  await apiClient.delete("/me", {
    data: { confirm: "DELETE" },
  });
}
