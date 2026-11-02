import { AppError } from "../../lib/errors.ts";
import type { ChunkItem } from "../../processing/retrieval.ts";
import type { Flashcard, FlashcardsContent } from "../schemas/flashcards.ts";
import type { QuizContent, QuizQuestion } from "../schemas/quiz.ts";
import type { SourceRef, SummaryContent } from "../schemas/summary.ts";

export function resolveSourceRefs(
  refs: SourceRef[] | undefined,
  chunksMap: Map<string, ChunkItem>,
): SourceRef[] {
  if (!refs || !Array.isArray(refs)) return [];

  const resolved: SourceRef[] = [];
  for (const ref of refs) {
    if (!ref.chunkId || !chunksMap.has(ref.chunkId)) {
      continue;
    }

    const chunk = chunksMap.get(ref.chunkId)!;
    const page = chunk.page;

    let validQuote: string | null = null;
    if (ref.quote && typeof ref.quote === "string") {
      const normalizedQuote = ref.quote.replace(/\s+/g, " ").trim();
      const normalizedChunk = chunk.text.replace(/\s+/g, " ");

      if (normalizedQuote.length <= 200 && normalizedChunk.includes(normalizedQuote)) {
        validQuote = normalizedQuote;
      }
    }

    resolved.push({
      chunkId: ref.chunkId,
      page,
      quote: validQuote,
    });
  }

  return resolved;
}

export function postprocessSummary(
  summary: SummaryContent,
  chunksMap: Map<string, ChunkItem>,
): SummaryContent {
  const overview = summary.overview?.trim() || "";
  if (!overview) {
    throw new AppError("AI_OUTPUT_INVALID", { message: "Summary overview cannot be empty" });
  }

  const keyPoints = (summary.keyPoints || [])
    .filter((kp) => kp.text && kp.text.trim().length > 0)
    .map((kp) => ({
      text: kp.text.trim(),
      sourceRefs: resolveSourceRefs(kp.sourceRefs, chunksMap),
    }));

  const sections = (summary.sections || [])
    .filter((sec) => sec.heading && sec.heading.trim().length > 0)
    .map((sec) => ({
      heading: sec.heading.trim(),
      body: sec.body.trim(),
      sourceRefs: resolveSourceRefs(sec.sourceRefs, chunksMap),
    }));

  const glossary = (summary.glossary || [])
    .filter((g) => g.term && g.term.trim().length > 0)
    .map((g) => ({ term: g.term.trim(), definition: g.definition.trim() }));

  const limitations = (summary.limitations || [])
    .filter((l) => typeof l === "string" && l.trim().length > 0)
    .map((l) => l.trim());

  return {
    overview,
    keyPoints,
    sections,
    glossary,
    limitations,
  };
}

export function postprocessFlashcards(
  content: FlashcardsContent,
  chunksMap: Map<string, ChunkItem>,
  targetCount: number,
): FlashcardsContent {
  const rawCards = content.cards || [];
  const processedCards: Flashcard[] = [];
  const seenFronts = new Set<string>();

  for (const card of rawCards) {
    const front = card.front?.trim() || "";
    const back = card.back?.trim() || "";

    if (!front || !back) continue;
    if (front.length > 400 || back.length > 800) continue;

    // Deduplication by normalized front
    const normalizedFront = front.toLowerCase().replace(/\s+/g, "");
    if (seenFronts.has(normalizedFront)) continue;
    seenFronts.add(normalizedFront);

    processedCards.push({
      id: `card-${processedCards.length + 1}`,
      front,
      back,
      hint: card.hint?.trim() || null,
      tags: (card.tags || []).map((t) => t.trim()).filter((t) => t.length > 0),
      sourceRefs: resolveSourceRefs(card.sourceRefs, chunksMap),
    });

    if (processedCards.length >= targetCount) break;
  }

  if (processedCards.length === 0) {
    throw new AppError("AI_OUTPUT_INVALID", { message: "No valid flashcards generated" });
  }

  return { cards: processedCards };
}

export function postprocessQuiz(
  content: QuizContent,
  chunksMap: Map<string, ChunkItem>,
  targetCount: number,
): QuizContent {
  const rawQuestions = content.questions || [];
  const validQuestions: QuizQuestion[] = [];

  for (const q of rawQuestions) {
    const prompt = q.prompt?.trim();
    if (!prompt) continue;

    const explanation = q.explanation?.trim() || "";

    if (q.type === "multiple_choice") {
      const choices = (q.choices || []).filter((c) => c.text && c.text.trim().length > 0);
      if (choices.length < 3 || choices.length > 5) continue;

      const choiceIds = new Set(choices.map((c) => c.id));
      if (!q.correctChoiceId || !choiceIds.has(q.correctChoiceId)) continue;

      // Seeded shuffle of choices so correct position is distributed
      const shuffledChoices = shuffleChoices(choices);

      validQuestions.push({
        id: `q-${validQuestions.length + 1}`,
        type: "multiple_choice",
        prompt,
        choices: shuffledChoices,
        correctChoiceId: q.correctChoiceId,
        acceptedAnswers: null,
        modelAnswer: null,
        explanation,
        difficulty: q.difficulty || "medium",
        sourceRefs: resolveSourceRefs(q.sourceRefs, chunksMap),
      });
    } else if (q.type === "true_false") {
      const correctChoiceId =
        q.correctChoiceId === "true" || q.correctChoiceId === "false" ? q.correctChoiceId : "true";

      validQuestions.push({
        id: `q-${validQuestions.length + 1}`,
        type: "true_false",
        prompt,
        choices: [
          { id: "true", text: "จริง" },
          { id: "false", text: "เท็จ" },
        ],
        correctChoiceId,
        acceptedAnswers: null,
        modelAnswer: null,
        explanation,
        difficulty: q.difficulty || "easy",
        sourceRefs: resolveSourceRefs(q.sourceRefs, chunksMap),
      });
    } else if (q.type === "short_answer") {
      const accepted = (q.acceptedAnswers || []).map((a) => a.trim()).filter((a) => a.length > 0);

      if (accepted.length === 0 && !q.modelAnswer) continue;

      validQuestions.push({
        id: `q-${validQuestions.length + 1}`,
        type: "short_answer",
        prompt,
        choices: null,
        correctChoiceId: null,
        acceptedAnswers: accepted.length > 0 ? accepted : [q.modelAnswer!.trim()],
        modelAnswer: q.modelAnswer?.trim() || accepted[0],
        explanation,
        difficulty: q.difficulty || "medium",
        sourceRefs: resolveSourceRefs(q.sourceRefs, chunksMap),
      });
    }

    if (validQuestions.length >= targetCount) break;
  }

  // Check 60% threshold rule
  const minRequired = Math.ceil(targetCount * 0.6);
  if (validQuestions.length < minRequired) {
    throw new AppError("AI_OUTPUT_INVALID", {
      message: `Only ${validQuestions.length} valid questions generated out of ${targetCount} requested`,
    });
  }

  return { questions: validQuestions };
}

function shuffleChoices<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function buildDefaultMaterialTitle(
  type: "summary" | "flashcards" | "quiz",
  sourceTitle: string,
): string {
  const labels: Record<string, string> = {
    summary: "สรุป",
    flashcards: "แฟลชการ์ด",
    quiz: "แบบทดสอบ",
  };
  const label = labels[type] || "สื่อการเรียน";
  return `${label} - ${sourceTitle}`;
}
