import { type Static, Type } from "@sinclair/typebox";

export const ChatOutputSchema = Type.Object({
  answer: Type.String(),
  grounding: Type.Union([
    Type.Literal("source"),
    Type.Literal("general"),
    Type.Literal("mixed"),
    Type.Literal("insufficient_source"),
  ]),
  usedChunkIds: Type.Array(Type.String(), { default: [] }),
  suggestedFollowUps: Type.Array(Type.String(), { default: [] }),
});

export type ChatOutput = Static<typeof ChatOutputSchema>;
