export interface ChunkItem {
  id: string; // e.g. "c0"
  index: number;
  page: number | null;
  text: string;
  charCount: number;
}

const THAI_STOPWORDS = new Set([
  "ที่",
  "และ",
  "ใน",
  "การ",
  "เป็น",
  "มี",
  "ของ",
  "ให้",
  "ได้",
  "จะ",
  "กับ",
  "ว่า",
  "จาก",
  "ไม่",
  "โดย",
  "นี้",
  "ก็",
  "ถึง",
  "หรือ",
  "ต้อง",
]);

const ENGLISH_STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "and",
  "or",
  "is",
  "are",
  "was",
  "were",
  "this",
  "that",
  "it",
  "with",
  "as",
  "by",
]);

export function tokenizeText(text: string): string[] {
  const segmenter = new Intl.Segmenter("th", { granularity: "word" });
  const rawSegments = Array.from(segmenter.segment(text))
    .filter((s) => s.isWordLike)
    .map((s) => s.segment.toLowerCase().trim());

  return rawSegments.filter((token) => {
    if (token.length < 2) return false;
    if (THAI_STOPWORDS.has(token) || ENGLISH_STOPWORDS.has(token)) return false;
    return true;
  });
}

export function rankChunksBM25(query: string, chunks: ChunkItem[], topK = 6): ChunkItem[] {
  if (chunks.length <= topK) {
    return chunks;
  }

  const queryTokens = tokenizeText(query);
  if (queryTokens.length === 0) {
    return chunks.slice(0, topK);
  }

  const N = chunks.length;
  const docTokensList = chunks.map((c) => tokenizeText(c.text));
  const docLens = docTokensList.map((dt) => dt.length);
  const avgDocLen = docLens.reduce((a, b) => a + b, 0) / (N || 1);

  // Calculate Document Frequencies (DF)
  const df: Record<string, number> = {};
  for (const docTokens of docTokensList) {
    const uniqueTokens = new Set(docTokens);
    for (const token of uniqueTokens) {
      df[token] = (df[token] || 0) + 1;
    }
  }

  const k1 = 1.5;
  const b = 0.75;

  const scores: { chunk: ChunkItem; score: number }[] = [];

  for (let i = 0; i < N; i++) {
    const chunk = chunks[i];
    const docTokens = docTokensList[i];
    const docLen = docLens[i];

    // Term frequencies in doc
    const tf: Record<string, number> = {};
    for (const token of docTokens) {
      tf[token] = (tf[token] || 0) + 1;
    }

    let score = 0;
    for (const qToken of queryTokens) {
      const termDf = df[qToken] || 0;
      if (termDf === 0) continue;

      // Robertson-Sparck Jones IDF
      const idf = Math.log(1 + (N - termDf + 0.5) / (termDf + 0.5));
      const termTf = tf[qToken] || 0;
      const numerator = termTf * (k1 + 1);
      const denominator = termTf + k1 * (1 - b + b * (docLen / (avgDocLen || 1)));

      score += idf * (numerator / (denominator || 1));
    }

    scores.push({ chunk, score });
  }

  // Sort descending by score
  scores.sort((a, b) => b.score - a.score);

  const selected = scores.slice(0, topK).map((s) => s.chunk);

  // If c0 is not in selected and total source is short, add c0 for context
  const hasC0 = selected.some((c) => c.index === 0);
  if (!hasC0 && chunks.length > 0) {
    selected.unshift(chunks[0]);
    if (selected.length > topK) {
      selected.pop();
    }
  }

  // Sort back by ascending index for coherent reading order
  selected.sort((a, b) => a.index - b.index);

  return selected;
}
