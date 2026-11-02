import { type Static, Type } from "@sinclair/typebox";

export const SourceRefSchema = Type.Object({
  chunkId: Type.String(),
  page: Type.Union([Type.Number(), Type.Null()]),
  quote: Type.Union([Type.String(), Type.Null()]),
});

export const KeyPointSchema = Type.Object({
  text: Type.String(),
  sourceRefs: Type.Array(SourceRefSchema, { default: [] }),
});

export const SummarySectionSchema = Type.Object({
  heading: Type.String(),
  body: Type.String(),
  sourceRefs: Type.Array(SourceRefSchema, { default: [] }),
});

export const GlossaryItemSchema = Type.Object({
  term: Type.String(),
  definition: Type.String(),
});

export const SummaryContentSchema = Type.Object({
  overview: Type.String(),
  keyPoints: Type.Array(KeyPointSchema),
  sections: Type.Array(SummarySectionSchema),
  glossary: Type.Array(GlossaryItemSchema, { default: [] }),
  limitations: Type.Array(Type.String(), { default: [] }),
});

export type SourceRef = Static<typeof SourceRefSchema>;
export type SummaryContent = Static<typeof SummaryContentSchema>;
