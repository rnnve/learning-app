export type Language = "th" | "en";
export type ContentLanguage = "auto" | "th" | "en";
export type Level = "primary" | "lower_secondary" | "upper_secondary" | "university" | "general";
export type Theme = "system" | "light" | "dark";
export type SourceKind = "images" | "txt" | "pdf" | "docx";
export type SourceStatus = "queued" | "processing" | "ready" | "partial" | "failed";
export type DetectedLanguage = "th" | "en" | "mixed" | "unknown";
export type ExtractionMethod = "direct_text" | "vision_ocr" | "hybrid";
export type ExtractionQuality = "good" | "fair" | "poor" | "unreadable";
export type JobType =
  | "source_processing"
  | "generate_summary"
  | "generate_flashcards"
  | "generate_quiz";
export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";
export type MaterialType = "summary" | "flashcards" | "quiz";
export type GenerationMode = "live" | "fixture";
export type Grounding = "source" | "general" | "mixed" | "insufficient_source";
export type QuestionType = "multiple_choice" | "true_false" | "short_answer";
export type Difficulty = "easy" | "medium" | "hard" | "mixed";
export type CardRating = "again" | "hard" | "good" | "easy";
export type Verdict = "correct" | "partially_correct" | "incorrect";

export interface ErrorBody {
  code: string;
  message: string;
  retryable: boolean;
  requestId?: string;
  details?: Record<string, unknown> | null;
}

export interface AuthTokens {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

export interface Preferences {
  uiLanguage: Language;
  contentLanguage: ContentLanguage;
  level: Level;
  theme: Theme;
}

export interface UserConsent {
  aiProcessing: boolean;
  version: string | null;
  acceptedAt: string | null;
}

export interface User {
  id: string;
  email: string | null;
  displayName: string;
  isGuest: boolean;
  preferences: Preferences;
  consent: UserConsent;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

export interface ExtractionWarning {
  code: string;
  message: string;
  page: number | null;
}

export interface Extraction {
  method: ExtractionMethod | null;
  quality: ExtractionQuality | null;
  pagesTotal: number;
  pagesExtracted: number;
  pagesFailed: number[];
  warnings: ExtractionWarning[];
}

export interface Source {
  id: string;
  title: string;
  kind: SourceKind;
  originalFilenames: string[];
  sizeBytes: number;
  pageCount: number;
  fileCount: number;
  language: DetectedLanguage;
  charCount: number;
  status: SourceStatus;
  extraction: Extraction;
  error: ErrorBody | null;
  jobId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SourceChunk {
  id: string;
  index: number;
  page: number | null;
  text: string;
  charCount: number;
}

export interface SourceRef {
  chunkId: string;
  page: number | null;
  quote: string | null;
}

export interface Job {
  sourceId?: string | null;
  materialId?: string | null;
  id: string;
  type: JobType;
  status: JobStatus;
  stage: string | null;
  progress: number;
  detail: { page?: number; pagesTotal?: number } | null;
  attempt: number;
  error: ErrorBody | null;
  result: { sourceId?: string; materialId?: string } | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface GeneratedBy {
  provider: "gemini" | "nemotron" | "fake";
  model: string;
  promptVersion: string;
  mode: GenerationMode;
}

export interface SummaryContent {
  overview: string;
  keyPoints: Array<{ text: string; sourceRefs: SourceRef[] }>;
  sections: Array<{ heading: string; body: string; sourceRefs: SourceRef[] }>;
  glossary: Array<{ term: string; definition: string }>;
  limitations: string[];
}

export interface FlashcardItem {
  id: string;
  front: string;
  back: string;
  hint: string | null;
  tags: string[];
  sourceRefs: SourceRef[];
}

export interface FlashcardsContent {
  cards: FlashcardItem[];
}

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  choices: Array<{ id: string; text: string }> | null;
  correctChoiceId: string | null;
  acceptedAnswers: string[] | null;
  modelAnswer: string | null;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
  sourceRefs: SourceRef[];
}

export interface QuizContent {
  questions: QuizQuestion[];
}

export interface Material {
  id: string;
  type: MaterialType;
  sourceId: string | null;
  title: string;
  content: SummaryContent | FlashcardsContent | QuizContent;
  options: Record<string, unknown>;
  isSaved: boolean;
  generatedBy: GeneratedBy;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialSummary {
  id: string;
  type: MaterialType;
  sourceId: string | null;
  title: string;
  itemCount: number;
  options: Record<string, unknown>;
  isSaved: boolean;
  generatedBy: GeneratedBy;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  sourceId: string | null;
  lastMessagePreview: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  grounding: Grounding | null;
  citations: SourceRef[];
  suggestedFollowUps: string[];
  clientMessageId: string | null;
  createdAt: string;
}

export interface StudySession {
  id: string;
  materialId: string;
  mode: "flashcards" | "quiz";
  status: "active" | "completed";
  itemsTotal: number;
  itemsAnswered: number;
  score: number | null;
  startedAt: string;
  completedAt: string | null;
}

export interface AnswerResult {
  itemId: string;
  verdict: Verdict | null;
  correctChoiceId: string | null;
  explanation: string | null;
  feedback: string | null;
  nextDueAt: string | null;
}

export interface FlashcardProgressItem {
  cardId: string;
  dueAt: string;
  box: number;
  lastRating: CardRating | null;
}

export interface HomeResponse {
  stats: {
    sources: number;
    materials: number;
    sessionsLast7Days: number;
  };
  activeJobs: Job[];
  recentSources: Source[];
  recentMaterials: MaterialSummary[];
}

export interface MetaResponse {
  apiVersion: string;
  promptVersion: string;
  limits: {
    maxImageBytes: number;
    maxDocumentBytes: number;
    maxImagesPerSource: number;
    maxPdfPages: number;
    maxChatMessageChars: number;
    maxGenerationsPerDay: number;
    maxChatMessagesPerDay: number;
  };
  supported: {
    imageMimeTypes: string[];
    documentMimeTypes: string[];
  };
  ai: {
    extraction: "live" | "fixture" | "disabled";
    generation: "live" | "fixture" | "disabled";
  };
  consentVersion: string;
}

export interface HealthResponse {
  status: "ok";
  version: string;
  uptimeSec: number;
}

export interface ReadyResponse {
  status: "ready" | "not_ready";
  checks: {
    database: "ok" | "fail";
    storage: "ok" | "fail";
    migrations: "ok" | "fail";
    nemotron: "configured" | "not_configured";
    gemini: "configured" | "not_configured";
  };
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
}
