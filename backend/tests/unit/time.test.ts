import { describe, expect, it } from "bun:test";
import { getBangkokDateString, getBangkokMidnightIso } from "../../src/lib/time.ts";

describe("Time & Asia/Bangkok Quota Boundaries", () => {
  it("formats dates in Asia/Bangkok timezone correctly", () => {
    // 2026-10-17 18:00:00 UTC is 2026-10-18 01:00:00 Bangkok time (UTC+7)
    const utcEvening = new Date("2026-10-17T18:00:00Z");
    const bkkDate = getBangkokDateString(utcEvening);
    expect(bkkDate).toBe("2026-10-18");
  });

  it("calculates next Bangkok midnight ISO accurately", () => {
    const testDate = new Date("2026-10-17T10:00:00Z"); // 17:00 Bangkok
    const midnightIso = getBangkokMidnightIso(testDate);
    // Bangkok midnight on 2026-10-18 is 2026-10-17 17:00:00 UTC
    expect(new Date(midnightIso).getTime()).toBeGreaterThan(testDate.getTime());
  });
});
