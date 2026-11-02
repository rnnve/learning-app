export type CardRating = "again" | "hard" | "good" | "easy";

export interface LeitnerState {
  box: number; // 1..5
  dueAt: Date;
  lastRating: CardRating | null;
}

// Intervals in milliseconds:
// 1 = 10 min
// 2 = 1 day
// 3 = 3 days
// 4 = 7 days
// 5 = 21 days
const BOX_INTERVALS_MS: Record<number, number> = {
  1: 10 * 60 * 1000,
  2: 24 * 60 * 60 * 1000,
  3: 3 * 24 * 60 * 60 * 1000,
  4: 7 * 24 * 60 * 60 * 1000,
  5: 21 * 24 * 60 * 60 * 1000,
};

export function computeNextLeitnerState(
  currentState: LeitnerState | null,
  rating: CardRating,
  now: Date = new Date(),
): LeitnerState {
  const currentBox = currentState?.box ?? 1;
  let nextBox = currentBox;
  let intervalMs = BOX_INTERVALS_MS[1];

  switch (rating) {
    case "again":
      nextBox = 1;
      intervalMs = BOX_INTERVALS_MS[1];
      break;

    case "hard":
      nextBox = currentBox;
      intervalMs = Math.round(BOX_INTERVALS_MS[currentBox] / 2);
      break;

    case "good":
      nextBox = Math.min(5, currentBox + 1);
      intervalMs = BOX_INTERVALS_MS[nextBox];
      break;

    case "easy":
      nextBox = Math.min(5, currentBox + 2);
      intervalMs = BOX_INTERVALS_MS[nextBox];
      break;
  }

  const dueAt = new Date(now.getTime() + intervalMs);

  return {
    box: nextBox,
    dueAt,
    lastRating: rating,
  };
}
