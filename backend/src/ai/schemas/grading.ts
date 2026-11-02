import { type Static, Type } from "@sinclair/typebox";

export const GradingOutputSchema = Type.Object({
  verdict: Type.Union([
    Type.Literal("correct"),
    Type.Literal("partially_correct"),
    Type.Literal("incorrect"),
  ]),
  feedback: Type.String(),
});

export type GradingOutput = Static<typeof GradingOutputSchema>;
