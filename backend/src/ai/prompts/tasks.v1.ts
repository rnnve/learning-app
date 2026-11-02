export function buildSummaryTaskPrompt(options: {
  language: string;
  level: string;
  length?: "short" | "medium" | "detailed";
}): string {
  const length = options.length || "medium";
  return `TASK: Produce a source-grounded academic summary of the provided source material.
Target audience level: ${options.level}. Output language: ${options.language}. Summary length: ${length}.

Rules:
1. length rules:
   - "short": overview 2-3 sentences + 3-5 keyPoints, no sections beyond 1-2.
   - "medium": overview + 5-8 keyPoints + 2-5 sections.
   - "detailed": fuller sections (still strictly from source) + glossary.
2. Every keyPoint and section MUST include sourceRefs linking to chunk ids that appear in the source.
3. quote in sourceRefs must be a verbatim substring (<= 200 chars) from that chunk. If not directly quoting, use null.
4. glossary is for important terminology explicitly present in the source.
5. limitations lists unreadable parts, illegible text, or missing context noted in the document.
6. NO facts absent from the source. No outside knowledge in summaries.
7. Output ONLY a valid JSON object matching the SummaryContent schema.`;
}

export function buildFlashcardsTaskPrompt(options: {
  count: number;
  language: string;
  level: string;
}): string {
  return `TASK: Produce exactly ${options.count} high-quality flashcards testing key concepts from the source material.
Target level: ${options.level}. Output language: ${options.language}.

Rules:
1. Produce exactly ${options.count} cards (or fewer if the source cannot support them without padding; never pad).
2. Each card tests ONE specific concept or idea answerable directly from the source.
3. Front is a clear question or prompt (no fill-in-the-blank / cloze).
4. Back is a concise answer (<= 3 short sentences).
5. hint is optional (null if not needed).
6. tags should be 1-3 short topic labels.
7. Cover the source broadly; avoid near-duplicate cards.
8. Include sourceRefs for each card referencing the chunk ids where the concept is found.
9. Output ONLY a valid JSON object matching the FlashcardsContent schema.`;
}

export function buildQuizTaskPrompt(options: {
  count: number;
  difficulty: string;
  questionTypes: string[];
  language: string;
  level: string;
}): string {
  return `TASK: Produce ${options.count} practice questions from the source material.
Difficulty: ${options.difficulty}. Question types: ${options.questionTypes.join(", ")}.
Target level: ${options.level}. Output language: ${options.language}.

Rules:
1. multiple_choice: 4 choices (choices ids "a", "b", "c", "d"), exactly one correct choice id in correctChoiceId. Plausible distractors based on common misconceptions; no "all of the above".
2. true_false: exactly 2 choices with ids "true" and "false". correctChoiceId is "true" or "false".
3. short_answer: concise question with acceptedAnswers (2-5 normalized text variants, including Thai and English forms if relevant) and modelAnswer.
4. explanation must explain why the correct answer is right and why distractors are wrong.
5. Every question must include sourceRefs referencing the source chunk ids.
6. Vary cognitive difficulty (recall, comprehension, application) matching ${options.difficulty}.
7. Output ONLY a valid JSON object matching the QuizContent schema.`;
}

export function buildChatTaskPrompt(options: {
  language: string;
  level: string;
}): string {
  return `TASK: You are น้องติว (Nong Tiw), answering the student's question based on the conversation history and the provided source material.
Target level: ${options.level}. Output language: ${options.language}.

Rules:
1. Answer the student's query warmly, clearly, and step by step.
2. If SOURCE MATERIAL is provided, prioritize it. Set grounding to:
   - "source" if answered strictly from source.
   - "mixed" if using source plus clearly labelled general knowledge ("นอกเหนือจากเอกสาร: ...").
   - "general" if no source was provided or the question is independent of the source.
   - "insufficient_source" if the source was provided but does not contain the answer.
3. In usedChunkIds, list the chunk ids (e.g. ["c0", "c2"]) actually utilized in the answer.
4. suggestedFollowUps should offer 1-3 short, natural follow-up questions the student might ask next.
5. Output ONLY a valid JSON object matching the ChatOutput schema.`;
}

export function buildGradingTaskPrompt(options: {
  question: string;
  modelAnswer: string;
  acceptedAnswers: string[];
  studentAnswer: string;
}): string {
  return `TASK: Grade the student's short answer response fairly and encouragement-first.
Question: ${options.question}
Model Answer: ${options.modelAnswer}
Accepted Variants: ${options.acceptedAnswers.join(" | ")}
Student Answer: ${options.studentAnswer}

Rules:
1. Verdict must be "correct", "partially_correct", or "incorrect".
2. Be lenient on minor spelling mistakes or Thai vowel/tone mark variations; be strict on conceptual meaning.
3. Provide constructive feedback (1-3 sentences) explaining what was right or where the misunderstanding is.
4. Output ONLY a valid JSON object matching the GradingOutput schema.`;
}

export function buildMapSectionNotesPrompt(options: {
  language: string;
  level: string;
}): string {
  return `TASK: Extract key factual notes and source citations from this section of the document for a subsequent summary.
Target level: ${options.level}. Output language: ${options.language}.

Extract:
1. Key factual bullet points, each with verbatim chunk citations.
2. Technical terms and definitions.
3. Ambiguities or illegible fragments.
Output ONLY a JSON object with: { "notes": [{ "text": string, "sourceRefs": [{ "chunkId": string, "page": number|null, "quote": string|null }] }], "glossary": [{ "term": string, "definition": string }] }`;
}
