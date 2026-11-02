import { apiClient } from "../client";
import type {
  AnswerResult,
  CardRating,
  FlashcardProgressItem,
  PaginatedResult,
  StudySession,
  Verdict,
} from "../types";

export async function createStudySession(params: {
  materialId: string;
  mode: "flashcards" | "quiz";
}): Promise<StudySession> {
  const response = await apiClient.post<StudySession>("/study-sessions", params);
  return response.data;
}

export async function getStudySessions(params?: {
  materialId?: string;
  limit?: number;
  cursor?: string;
}): Promise<PaginatedResult<StudySession>> {
  const response = await apiClient.get<PaginatedResult<StudySession>>("/study-sessions", {
    params,
  });
  return response.data;
}

export async function getStudySession(id: string): Promise<{
  session: StudySession;
  answers: Array<{
    itemId: string;
    verdict: Verdict | null;
    rating: CardRating | null;
    answeredAt: string;
  }>;
}> {
  const response = await apiClient.get<{
    session: StudySession;
    answers: Array<{
      itemId: string;
      verdict: Verdict | null;
      rating: CardRating | null;
      answeredAt: string;
    }>;
  }>(`/study-sessions/${id}`);
  return response.data;
}

export async function submitFlashcardAnswer(
  sessionId: string,
  params: { itemId: string; rating: CardRating },
): Promise<AnswerResult> {
  const response = await apiClient.post<AnswerResult>(
    `/study-sessions/${sessionId}/answers`,
    params,
  );
  return response.data;
}

export async function submitQuizAnswer(
  sessionId: string,
  params: { itemId: string; choiceId?: string; text?: string },
): Promise<AnswerResult> {
  const response = await apiClient.post<AnswerResult>(
    `/study-sessions/${sessionId}/answers`,
    params,
    {
      timeout: 35000, // short_answer grading up to 35s
    },
  );
  return response.data;
}

export async function completeStudySession(sessionId: string): Promise<StudySession> {
  const response = await apiClient.post<StudySession>(`/study-sessions/${sessionId}/complete`, {});
  return response.data;
}

export async function getFlashcardProgress(materialId: string): Promise<FlashcardProgressItem[]> {
  const response = await apiClient.get<FlashcardProgressItem[]>(
    `/materials/${materialId}/flashcard-progress`,
  );
  return response.data;
}
