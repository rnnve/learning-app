import { formatBytes, formatDate, formatDateTime, formatNumber, formatPercent } from "@/lib/format";

describe("format utilities", () => {
  describe("formatBytes", () => {
    it("formats bytes correctly", () => {
      expect(formatBytes(0)).toBe("0 B");
      expect(formatBytes(500)).toBe("500 B");
      expect(formatBytes(1024)).toBe("1.0 KB");
      expect(formatBytes(1536)).toBe("1.5 KB");
      expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
      expect(formatBytes(1024 * 1024 * 1024)).toBe("1.0 GB");
    });
  });

  describe("formatDate", () => {
    it("formats date in Thai locale", () => {
      const date = new Date("2024-01-15T10:30:00");
      const result = formatDate(date, "th");
      expect(result).toContain("15");
      expect(result).toContain("ม.ค.");
      expect(result).toContain("2567");
    });

    it("formats date in English locale", () => {
      const date = new Date("2024-01-15T10:30:00");
      const result = formatDate(date, "en");
      expect(result).toContain("Jan");
      expect(result).toContain("15");
      expect(result).toContain("2024");
    });
  });

  describe("formatDateTime", () => {
    it("formats date time in Thai locale", () => {
      const date = new Date("2024-01-15T10:30:00");
      const result = formatDateTime(date, "th");
      expect(result).toContain("15");
      expect(result).toContain("ม.ค.");
      expect(result).toContain("2567");
      expect(result).toContain("10");
      expect(result).toContain("30");
    });

    it("formats date time in English locale", () => {
      const date = new Date("2024-01-15T10:30:00");
      const result = formatDateTime(date, "en");
      expect(result).toContain("Jan");
      expect(result).toContain("15");
      expect(result).toContain("2024");
      expect(result).toContain("10");
      expect(result).toContain("30");
    });
  });

  describe("formatNumber", () => {
    it("formats numbers in Thai locale", () => {
      expect(formatNumber(1000, "th")).toBe("1,000");
      expect(formatNumber(1234567, "th")).toBe("1,234,567");
    });

    it("formats numbers in English locale", () => {
      expect(formatNumber(1000, "en")).toBe("1,000");
      expect(formatNumber(1234567, "en")).toBe("1,234,567");
    });
  });

  describe("formatPercent", () => {
    it("formats percentages in Thai locale", () => {
      expect(formatPercent(0.5, "th")).toBe("50%");
      expect(formatPercent(0.1234, "th")).toBe("12%");
    });

    it("formats percentages in English locale", () => {
      expect(formatPercent(0.5, "en")).toBe("50%");
      expect(formatPercent(0.1234, "en")).toBe("12%");
    });
  });
});
