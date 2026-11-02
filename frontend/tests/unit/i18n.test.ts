/**
 * i18n contract tests (contract Section 13):
 *  - Thai and English resources have exactly the same key set
 *  - no translation is an empty string
 *  - every contract error code (Section 3.2) has a localized message
 *  - every contract enum value (Section 3.3) has a label in th + en
 */
import en from "@/i18n/en.json";
import th from "@/i18n/th.json";

type Json = Record<string, unknown>;

function flatten(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [prefix];
  }
  const out: string[] = [];
  for (const [key, child] of Object.entries(value as Json)) {
    const path = prefix ? `${prefix}.${key}` : key;
    out.push(...flatten(child, path));
  }
  return out;
}

function get(obj: Json, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, part) => {
    if (acc === null || typeof acc !== "object") return undefined;
    return (acc as Json)[part];
  }, obj);
}

/** Contract Section 3.2 - every error code the backend can return. */
const CONTRACT_ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHENTICATED",
  "TOKEN_EXPIRED",
  "INVALID_CREDENTIALS",
  "REFRESH_TOKEN_INVALID",
  "REFRESH_TOKEN_REUSED",
  "FORBIDDEN",
  "CONSENT_REQUIRED",
  "NOT_FOUND",
  "EMAIL_TAKEN",
  "REQUEST_IN_PROGRESS",
  "SOURCE_NOT_READY",
  "JOB_NOT_RETRYABLE",
  "IDEMPOTENCY_KEY_REUSED",
  "FILE_TOO_LARGE",
  "UNSUPPORTED_MEDIA_TYPE",
  "TOO_MANY_FILES",
  "FILE_CORRUPT",
  "PDF_ENCRYPTED",
  "TOO_MANY_PAGES",
  "RATE_LIMITED",
  "QUOTA_EXCEEDED",
  "AI_NOT_CONFIGURED",
  "AI_PROVIDER_UNAVAILABLE",
  "AI_TIMEOUT",
  "AI_CONTENT_BLOCKED",
  "AI_OUTPUT_INVALID",
  "IMAGE_UNREADABLE",
  "NO_EXTRACTABLE_CONTENT",
  "EXTRACTION_FAILED",
  "INTERNAL_ERROR",
  // Client-side codes produced by the API layer.
  "NETWORK_ERROR",
  "CLIENT_TIMEOUT",
  "GENERIC_FALLBACK",
] as const;

/** Contract Section 3.3 - every enum, mapped to its i18n namespace. */
const CONTRACT_ENUMS: Record<string, string[]> = {
  "enums.levels": ["primary", "lower_secondary", "upper_secondary", "university", "general"],
  "enums.contentLanguages": ["auto", "th", "en"],
  "enums.themes": ["system", "light", "dark"],
  "enums.sourceKinds": ["images", "txt", "pdf", "docx"],
  "enums.sourceStatuses": ["queued", "processing", "ready", "partial", "failed"],
  "enums.jobStatuses": ["queued", "running", "succeeded", "failed", "canceled"],
  "enums.jobTypes": [
    "source_processing",
    "generate_summary",
    "generate_flashcards",
    "generate_quiz",
  ],
  "enums.materialTypes": ["summary", "flashcards", "quiz"],
  "enums.questionTypes": ["multiple_choice", "true_false", "short_answer"],
  "enums.difficulties": ["easy", "medium", "hard", "mixed"],
  "enums.cardRatings": ["again", "hard", "good", "easy"],
  "enums.verdicts": ["correct", "partially_correct", "incorrect"],
  "enums.detectedLanguages": ["th", "en", "mixed", "unknown"],
  "enums.extractionMethods": ["direct_text", "vision_ocr", "hybrid"],
  "enums.extractionQuality": ["good", "fair", "poor", "unreadable"],
  "enums.generationModes": ["live", "fixture"],
  "enums.stages": [
    "validating",
    "normalizing_images",
    "extracting_text",
    "ocr",
    "chunking",
    "finalizing",
    "preparing_context",
    "generating",
    "validating_output",
    "saving",
  ],
};

describe("i18n resources", () => {
  it("has the exact same key set in Thai and English", () => {
    const thKeys = flatten(th).sort();
    const enKeys = flatten(en).sort();

    expect(enKeys).toEqual(thKeys);
  });

  it("has no empty translation", () => {
    const empties: string[] = [];
    for (const [label, resource] of [
      ["th", th],
      ["en", en],
    ] as const) {
      for (const key of flatten(resource)) {
        const value = get(resource as Json, key);
        if (typeof value !== "string" || value.trim().length === 0) {
          empties.push(`${label}:${key}`);
        }
      }
    }
    expect(empties).toEqual([]);
  });

  it("keeps the interpolation placeholders identical in both languages", () => {
    const placeholders = (value: string) => (value.match(/%\{[^}]+\}/g) ?? []).sort().join(",");

    const diffs: string[] = [];
    const walk = (a: unknown, b: unknown, path: string) => {
      if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) {
        if (typeof a === "string" && typeof b === "string") {
          if (placeholders(a) !== placeholders(b)) diffs.push(path);
        }
        return;
      }
      for (const key of Object.keys(a as Json)) {
        walk((a as Json)[key], (b as Json)[key], path ? `${path}.${key}` : key);
      }
    };
    walk(th, en, "");

    expect(diffs).toEqual([]);
  });
});

describe("contract error codes", () => {
  it.each(CONTRACT_ERROR_CODES)("has a Thai and English message for %s", (code) => {
    const thValue = get(th as Json, `errors.${code}`);
    const enValue = get(en as Json, `errors.${code}`);

    expect(typeof thValue).toBe("string");
    expect(typeof enValue).toBe("string");
    expect(String(thValue).trim().length).toBeGreaterThan(0);
    expect(String(enValue).trim().length).toBeGreaterThan(0);
  });

  it("does not leak the raw error code into the user facing message", () => {
    for (const code of CONTRACT_ERROR_CODES) {
      const thValue = String(get(th as Json, `errors.${code}`));
      const enValue = String(get(en as Json, `errors.${code}`));
      expect(thValue).not.toContain(code);
      expect(enValue).not.toContain(code);
    }
  });
});

describe("contract enums", () => {
  for (const [namespace, values] of Object.entries(CONTRACT_ENUMS)) {
    it(`labels every value of ${namespace} in Thai and English`, () => {
      for (const key of values) {
        const path = `${namespace}.${key}`;
        const thValue = get(th as Json, path);
        const enValue = get(en as Json, path);

        expect([path, thValue]).toEqual([path, expect.any(String)]);
        expect([path, enValue]).toEqual([path, expect.any(String)]);
        expect(String(thValue).trim().length).toBeGreaterThan(0);
        expect(String(enValue).trim().length).toBeGreaterThan(0);
      }
    });
  }

  it("labels the Grounding enum through the chat namespace", () => {
    const grounding = ["source", "general", "mixed", "insufficient_source"];
    for (const value of grounding) {
      const path = `chat.grounding${
        {
          source: "Source",
          general: "General",
          mixed: "Mixed",
          insufficient_source: "Insufficient",
        }[value]
      }`;
      expect(String(get(th as Json, path)).trim().length).toBeGreaterThan(0);
      expect(String(get(en as Json, path)).trim().length).toBeGreaterThan(0);
    }
  });
});
