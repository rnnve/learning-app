/**
 * Formatting helper tests (contract Section 13): dates and numbers have to be
 * rendered in the active UI language (Thai by default, English as alternative).
 */
import { formatBytes, formatDate, formatDateTime, formatNumber, formatPercent } from "@/lib/format";

const SAMPLE = "2026-03-15T09:30:00.000Z";

describe("formatDate", () => {
  it("formats a date in Thai by default", () => {
    const th = formatDate(SAMPLE, "th");
    // Thai Buddhist era - the year is offset by 543.
    expect(th).toContain("2569");
    expect(th).not.toContain("2026");
  });

  it("formats a date in English", () => {
    const en = formatDate(SAMPLE, "en");
    expect(en).toContain("2026");
    expect(en).not.toContain("2569");
    expect(en).toContain("Mar");
  });

  it("returns an empty string for an invalid date", () => {
    expect(formatDate("not-a-date", "en")).toBe("");
  });

  it("accepts a Date instance and a timestamp", () => {
    const date = new Date(SAMPLE);
    expect(formatDate(date, "en")).toBe(formatDate(date.getTime(), "en"));
  });

  it("honours custom Intl options", () => {
    expect(formatDate(SAMPLE, "en", { year: "2-digit" })).toContain("26");
  });
});

describe("formatDateTime", () => {
  it("includes the time in both languages", () => {
    expect(formatDateTime(SAMPLE, "en")).toMatch(/\d{1,2}:\d{2}/);
    expect(formatDateTime(SAMPLE, "th")).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe("formatNumber", () => {
  it("uses the Thai locale by default", () => {
    expect(formatNumber(1234.5)).toBe(new Intl.NumberFormat("th-TH").format(1234.5));
  });

  it("uses the English locale when requested", () => {
    expect(formatNumber(1234.5, "en")).toBe(new Intl.NumberFormat("en-US").format(1234.5));
  });

  it("formats zero and negative numbers", () => {
    expect(formatNumber(0, "en")).toBe("0");
    expect(formatNumber(-42, "en")).toContain("42");
  });
});

describe("formatPercent", () => {
  it("renders a percentage with no decimals", () => {
    expect(formatPercent(0.5, "en")).toBe("50%");
    expect(formatPercent(1, "en")).toBe("100%");
    expect(formatPercent(0, "en")).toBe("0%");
  });
});

describe("formatBytes", () => {
  it("uses binary units", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1024 * 1024 * 3)).toBe("3.0 MB");
  });
});
