import i18n from "@/i18n";

describe("i18n", () => {
  it("provides Thai translations by default", () => {
    expect(i18n.t("common.save")).toBe("บันทึก");
    expect(i18n.t("common.cancel")).toBe("ยกเลิก");
    expect(i18n.t("navigation.home")).toBe("หน้าแรก");
  });

  it("switches to English", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("common.save")).toBe("Save");
    expect(i18n.t("common.cancel")).toBe("Cancel");
    expect(i18n.t("navigation.home")).toBe("Home");
  });

  it("switches back to Thai", async () => {
    await i18n.changeLanguage("th");
    expect(i18n.t("common.save")).toBe("บันทึก");
    expect(i18n.t("common.cancel")).toBe("ยกเลิก");
  });

  it("returns key for missing translations", () => {
    expect(i18n.t("nonexistent.key")).toBe("nonexistent.key");
  });

  it("handles interpolation", () => {
    expect(i18n.t("material.cardsCount", { count: 5 })).toContain("5");
    expect(i18n.t("study.scoreLabel", { score: 85 })).toContain("85");
  });

  it("handles pluralization", () => {
    expect(i18n.t("material.cardsCount", { count: 1 })).toContain("1");
    expect(i18n.t("material.cardsCount", { count: 5 })).toContain("5");
  });
});
