import { describe, expect, it } from "bun:test";
import { computeNextLeitnerState } from "../../src/services/leitner.ts";

describe("Leitner Spaced Repetition", () => {
  const baseNow = new Date("2026-10-17T12:00:00Z");

  it("handles new cards with 'good' rating (moves to box 2)", () => {
    const next = computeNextLeitnerState(null, "good", baseNow);
    expect(next.box).toBe(2);
    expect(next.lastRating).toBe("good");
    // Box 2 interval = 1 day = 86400000 ms
    const diffMs = next.dueAt.getTime() - baseNow.getTime();
    expect(diffMs).toBe(24 * 60 * 60 * 1000);
  });

  it("handles 'again' rating (drops back to box 1, due in 10 minutes)", () => {
    const current = { box: 4, dueAt: baseNow, lastRating: "good" as const };
    const next = computeNextLeitnerState(current, "again", baseNow);
    expect(next.box).toBe(1);
    expect(next.lastRating).toBe("again");
    const diffMs = next.dueAt.getTime() - baseNow.getTime();
    expect(diffMs).toBe(10 * 60 * 1000);
  });

  it("handles 'hard' rating (stays in same box, half interval)", () => {
    const current = { box: 3, dueAt: baseNow, lastRating: "good" as const };
    const next = computeNextLeitnerState(current, "hard", baseNow);
    expect(next.box).toBe(3);
    // Box 3 interval is 3 days; half is 1.5 days = 36 hours
    const diffMs = next.dueAt.getTime() - baseNow.getTime();
    expect(diffMs).toBe(Math.round((3 * 24 * 60 * 60 * 1000) / 2));
  });

  it("handles 'easy' rating (advances 2 boxes, capped at 5)", () => {
    const current = { box: 4, dueAt: baseNow, lastRating: "good" as const };
    const next = computeNextLeitnerState(current, "easy", baseNow);
    expect(next.box).toBe(5); // 4 + 2 capped at 5
    // Box 5 interval = 21 days
    const diffMs = next.dueAt.getTime() - baseNow.getTime();
    expect(diffMs).toBe(21 * 24 * 60 * 60 * 1000);
  });
});
