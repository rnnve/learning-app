import { type Static, Type } from "@sinclair/typebox";

export const ExtractionBlockSchema = Type.Object({
  type: Type.Union([
    Type.Literal("heading"),
    Type.Literal("paragraph"),
    Type.Literal("list"),
    Type.Literal("table"),
    Type.Literal("equation"),
    Type.Literal("diagram"),
    Type.Literal("other"),
  ]),
  text: Type.String(),
});

export const ExtractionSchema = Type.Object({
  language: Type.Union([
    Type.Literal("th"),
    Type.Literal("en"),
    Type.Literal("mixed"),
    Type.Literal("unknown"),
  ]),
  legibility: Type.Union([
    Type.Literal("good"),
    Type.Literal("fair"),
    Type.Literal("poor"),
    Type.Literal("unreadable"),
  ]),
  blocks: Type.Array(ExtractionBlockSchema),
  warnings: Type.Array(Type.String()),
});

export type ExtractionOutput = Static<typeof ExtractionSchema>;
