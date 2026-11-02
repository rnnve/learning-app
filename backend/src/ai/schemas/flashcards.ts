import { type Static, Type } from "@sinclair/typebox";
import { SourceRefSchema } from "./summary.ts";

export const FlashcardSchema = Type.Object({
  id: Type.String(),
  front: Type.String(),
  back: Type.String(),
  hint: Type.Union([Type.String(), Type.Null()], { default: null }),
  tags: Type.Array(Type.String(), { default: [] }),
  sourceRefs: Type.Array(SourceRefSchema, { default: [] }),
});

export const FlashcardsContentSchema = Type.Object({
  cards: Type.Array(FlashcardSchema),
});

export type Flashcard = Static<typeof FlashcardSchema>;
export type FlashcardsContent = Static<typeof FlashcardsContentSchema>;
