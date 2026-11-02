export type DetectedLanguage = "th" | "en" | "mixed" | "unknown";

export function detectLanguage(text: string): DetectedLanguage {
  if (!text || text.trim().length < 20) {
    return "unknown";
  }

  // Count Thai characters (U+0E00 to U+0E7F)
  const thaiMatches = text.match(/[\u0E00-\u0E7F]/g);
  const thaiCount = thaiMatches ? thaiMatches.length : 0;

  // Count Latin letters (a-z, A-Z)
  const latinMatches = text.match(/[a-zA-Z]/g);
  const latinCount = latinMatches ? latinMatches.length : 0;

  const totalLetters = thaiCount + latinCount;
  if (totalLetters === 0) {
    return "unknown";
  }

  const thaiRatio = thaiCount / totalLetters;

  if (thaiRatio > 0.6) {
    return "th";
  }
  if (thaiRatio < 0.05) {
    return "en";
  }
  return "mixed";
}
