import type { MaterialType, SourceKind, SourceStatus } from "./types";

export const queryKeys = {
  meta: ["meta"] as const,
  health: ["health"] as const,
  ready: ["ready"] as const,
  me: ["me"] as const,
  home: ["home"] as const,
  sources: (params?: {
    status?: SourceStatus;
    kind?: SourceKind;
    q?: string;
  }) => ["sources", params] as const,
  source: (id: string) => ["source", id] as const,
  sourceText: (id: string) => ["sourceText", id] as const,
  materials: (params?: {
    type?: MaterialType;
    sourceId?: string;
    saved?: boolean;
    q?: string;
  }) => ["materials", params] as const,
  material: (id: string) => ["material", id] as const,
  flashcardProgress: (materialId: string) => ["flashcardProgress", materialId] as const,
  jobs: ["jobs"] as const,
  activeJobs: ["jobs", "active"] as const,
  job: (id: string) => ["job", id] as const,
  conversations: (sourceId?: string) => ["conversations", { sourceId }] as const,
  conversation: (id: string) => ["conversation", id] as const,
  messages: (conversationId: string) => ["messages", conversationId] as const,
  studySessions: (params?: { materialId?: string }) => ["studySessions", params] as const,
  studySession: (id: string) => ["studySession", id] as const,
};
