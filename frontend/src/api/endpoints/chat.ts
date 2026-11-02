import { apiClient } from "../client";
import type { ContentLanguage, Conversation, Level, Message, PaginatedResult } from "../types";

export async function createConversation(params?: {
  title?: string;
  sourceId?: string | null;
}): Promise<Conversation> {
  const response = await apiClient.post<Conversation>("/conversations", params || {});
  return response.data;
}

export async function getConversations(params?: {
  sourceId?: string;
  limit?: number;
  cursor?: string;
}): Promise<PaginatedResult<Conversation>> {
  const response = await apiClient.get<PaginatedResult<Conversation>>("/conversations", {
    params,
  });
  return response.data;
}

export async function getConversation(id: string): Promise<Conversation> {
  const response = await apiClient.get<Conversation>(`/conversations/${id}`);
  return response.data;
}

export async function updateConversation(
  id: string,
  params: { title: string },
): Promise<Conversation> {
  const response = await apiClient.patch<Conversation>(`/conversations/${id}`, params);
  return response.data;
}

export async function deleteConversation(id: string): Promise<void> {
  await apiClient.delete(`/conversations/${id}`);
}

export async function getMessages(
  id: string,
  params?: { limit?: number; cursor?: string },
): Promise<PaginatedResult<Message>> {
  const response = await apiClient.get<PaginatedResult<Message>>(`/conversations/${id}/messages`, {
    params,
  });
  return response.data;
}

export async function sendMessage(params: {
  conversationId: string;
  content: string;
  clientMessageId: string;
  idempotencyKey: string;
  language?: ContentLanguage;
  level?: Level | "auto";
}): Promise<{ userMessage: Message; assistantMessage: Message }> {
  const { conversationId, idempotencyKey, ...body } = params;
  const response = await apiClient.post<{ userMessage: Message; assistantMessage: Message }>(
    `/conversations/${conversationId}/messages`,
    body,
    {
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
      timeout: 100000,
    },
  );
  return response.data;
}
