import { type Static, Type } from "@sinclair/typebox";
import { SourceRefSchema } from "./summary.ts";

export const ChoiceSchema = Type.Object({
  id: Type.String(),
  text: Type.String(),
});

export const QuizQuestionSchema = Type.Object({
  id: Type.String(),
  type: Type.Union([
    Type.Literal("multiple_choice"),
    Type.Literal("true_false"),
    Type.Literal("short_answer"),
  ]),
  prompt: Type.String(),
  choices: Type.Union([Type.Array(ChoiceSchema), Type.Null()], { default: null }),
  correctChoiceId: Type.Union([Type.String(), Type.Null()], { default: null }),
  acceptedAnswers: Type.Union([Type.Array(Type.String()), Type.Null()], { default: null }),
  modelAnswer: Type.Union([Type.String(), Type.Null()], { default: null }),
  explanation: Type.String(),
  difficulty: Type.Union([Type.Literal("easy"), Type.Literal("medium"), Type.Literal("hard")]),
  sourceRefs: Type.Array(SourceRefSchema, { default: [] }),
});

export const QuizContentSchema = Type.Object({
  questions: Type.Array(QuizQuestionSchema),
});

export type QuizQuestion = Static<typeof QuizQuestionSchema>;
export type QuizContent = Static<typeof QuizContentSchema>;
