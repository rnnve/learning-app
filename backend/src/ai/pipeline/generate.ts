import { env } from "../../config/env.ts";
import { AppError } from "../../lib/errors.ts";
import type { ChunkItem } from "../../processing/retrieval.ts";
import { PROMPT_VERSION, SYSTEM_PROMPT_V1 } from "../prompts/system.v1.ts";
import {
  buildFlashcardsTaskPrompt,
  buildQuizTaskPrompt,
  buildSummaryTaskPrompt,
} from "../prompts/tasks.v1.ts";
import type { GenerationProvider } from "../providers/types.ts";
import { type FlashcardsContent, FlashcardsContentSchema } from "../schemas/flashcards.ts";
import { type QuizContent, QuizContentSchema } from "../schemas/quiz.ts";
import { type SummaryContent, SummaryContentSchema } from "../schemas/summary.ts";
import {
  buildDefaultMaterialTitle,
  postprocessFlashcards,
  postprocessQuiz,
  postprocessSummary,
} from "./postprocess.ts";

export interface GenerateMaterialOptions {
  type: "summary" | "flashcards" | "quiz";
  sourceId: string;
  sourceTitle: string;
  sourceLanguage: string;
  options: {
    language?: "auto" | "th" | "en";
    level?: string;
    pageRange?: { from: number; to: number } | null;
    length?: "short" | "medium" | "detailed";
    count?: number;
    difficulty?: "easy" | "medium" | "hard" | "mixed";
    questionTypes?: ("multiple_choice" | "true_false" | "short_answer")[];
  };
  chunks: ChunkItem[];
  userPreferences: {
    contentLanguage?: string;
    level?: string;
  };
}

export interface GeneratedMaterialResult {
  title: string;
  content: SummaryContent | FlashcardsContent | QuizContent;
  options: Record<string, any>;
  generatedBy: {
    provider: "gemini" | "nemotron" | "fake";
    model: string;
    promptVersion: string;
    mode: "live" | "fixture";
  };
}

export async function generateMaterial(
  input: GenerateMaterialOptions,
  provider: GenerationProvider,
  signal: AbortSignal,
): Promise<GeneratedMaterialResult> {
  const { type, sourceTitle, sourceLanguage, options, chunks, userPreferences } = input;

  // 1. Filter by pageRange if provided
  let filteredChunks = chunks;
  if (options.pageRange) {
    const { from, to } = options.pageRange;
    filteredChunks = chunks.filter((c) => c.page !== null && c.page >= from && c.page <= to);
    if (filteredChunks.length === 0) {
      throw new AppError("VALIDATION_ERROR", {
        message: "No content found in the specified pageRange",
        details: { pageRange: options.pageRange },
      });
    }
  }

  const chunksMap = new Map<string, ChunkItem>();
  for (const c of filteredChunks) {
    chunksMap.set(c.id, c);
  }

  // 2. Resolve language and level
  const resolvedLang =
    options.language === "auto" || !options.language
      ? userPreferences.contentLanguage === "auto" || !userPreferences.contentLanguage
        ? sourceLanguage === "en"
          ? "en"
          : "th"
        : userPreferences.contentLanguage
      : options.language;

  const resolvedLevel =
    options.level === "auto" || !options.level ? userPreferences.level || "general" : options.level;

  const totalChars = filteredChunks.reduce((acc, c) => acc + c.charCount, 0);

  // 3. Delimit source text
  const sourceDelimited = [
    `<<<SOURCE title="${sourceTitle}" language="${sourceLanguage}">>>`,
    ...filteredChunks.map((c) => `[${c.id} p${c.page ?? 1}] ${c.text}`),
    "<<<END SOURCE>>>",
  ].join("\n\n");

  const isFixture = env.AI_MODE === "fixture";
  let modelName = isFixture ? "fixture" : env.GEMINI_MODEL || "gemini-3.8-flash";
  let providerName: "gemini" | "nemotron" | "fake" = isFixture ? "fake" : "gemini";

  let content: SummaryContent | FlashcardsContent | QuizContent;

  if (type === "summary") {
    const taskPrompt = buildSummaryTaskPrompt({
      language: resolvedLang,
      level: resolvedLevel,
      length: options.length || "medium",
    });

    const res = await provider.generateJson<SummaryContent>(
      {
        system: `${SYSTEM_PROMPT_V1}\n\n${taskPrompt}`,
        user: sourceDelimited,
        schema: SummaryContentSchema,
        schemaName: "SummaryContent",
      },
      { signal },
    );

    modelName = res.generation?.model ?? modelName;
    providerName = res.generation?.provider ?? providerName;
    content = postprocessSummary(res.data, chunksMap);
  } else if (type === "flashcards") {
    const count = options.count || 15;
    const taskPrompt = buildFlashcardsTaskPrompt({
      count,
      language: resolvedLang,
      level: resolvedLevel,
    });

    const res = await provider.generateJson<FlashcardsContent>(
      {
        system: `${SYSTEM_PROMPT_V1}\n\n${taskPrompt}`,
        user: sourceDelimited,
        schema: FlashcardsContentSchema,
        schemaName: "FlashcardsContent",
      },
      { signal },
    );

    modelName = res.generation?.model ?? modelName;
    providerName = res.generation?.provider ?? providerName;
    content = postprocessFlashcards(res.data, chunksMap, count);
  } else {
    // quiz
    const count = options.count || 10;
    const difficulty = options.difficulty || "mixed";
    const questionTypes = options.questionTypes || [
      "multiple_choice",
      "true_false",
      "short_answer",
    ];

    const taskPrompt = buildQuizTaskPrompt({
      count,
      difficulty,
      questionTypes,
      language: resolvedLang,
      level: resolvedLevel,
    });

    const res = await provider.generateJson<QuizContent>(
      {
        system: `${SYSTEM_PROMPT_V1}\n\n${taskPrompt}`,
        user: sourceDelimited,
        schema: QuizContentSchema,
        schemaName: "QuizContent",
      },
      { signal },
    );

    modelName = res.generation?.model ?? modelName;
    providerName = res.generation?.provider ?? providerName;
    content = postprocessQuiz(res.data, chunksMap, count);
  }

  const title = buildDefaultMaterialTitle(type, sourceTitle);

  return {
    title,
    content,
    options: {
      ...options,
      language: resolvedLang,
      level: resolvedLevel,
    },
    generatedBy: {
      provider: providerName,
      model: modelName,
      promptVersion: PROMPT_VERSION,
      mode: isFixture ? "fixture" : "live",
    },
  };
}
