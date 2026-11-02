import sharp from "sharp";
import { SYSTEM_PROMPT_V1 } from "../src/ai/prompts/system.v1.ts";
import { getExtractionProvider, getGenerationProvider } from "../src/ai/providers/factory.ts";
import { SummaryContentSchema } from "../src/ai/schemas/summary.ts";
import { env } from "../src/config/env.ts";

async function verifyProviders() {
  console.log("=== Verifying AI Providers ===");

  // 1. Nemotron
  console.log(`\n1. Checking OCR configuration (${env.NEMOTRON_MODEL})...`);
  if (!env.NEMOTRON_BASE_URL || !env.NEMOTRON_API_KEY) {
    console.log("   [SKIPPED] Nemotron keys not present in environment.");
  } else {
    try {
      const nemotron = getExtractionProvider();
      // Generate a readable sample so the smoke test verifies actual OCR output.
      const sampleJpeg = await sharp(
        Buffer.from(
          '<svg width="900" height="200"><rect width="900" height="200" fill="white"/><text x="30" y="110" font-size="48" fill="black">Study test: plants use sunlight.</text></svg>',
        ),
      )
        .jpeg()
        .toBuffer();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60000);
      timer.unref();
      const res = await nemotron.extractPage(
        { image: new Uint8Array(sampleJpeg), mime: "image/jpeg", pageHint: 1 },
        { signal: controller.signal },
      );
      clearTimeout(timer);
      if (!res.blocks.some((block) => /plants/i.test(block.text)))
        throw new Error("OCR did not recover the sample text");
      console.log("   [PASSED] NeMo Retriever OCR recovered the sample text:", res.legibility);
    } catch (err: any) {
      console.error("   [FAILED] OCR call failed:", err.message);
      process.exitCode = 1;
    }
  }

  // 2. Gemini with Nemotron generation fallback
  console.log(`\n2. Checking generation (${env.GEMINI_MODEL} with Nemotron fallback)...`);
  if (
    (!env.GEMINI_API_KEY || !env.GEMINI_MODEL) &&
    !env.NEMOTRON_GENERATION_API_KEY &&
    !env.NEMOTRON_API_KEY
  ) {
    console.log("   [SKIPPED] No generation provider credentials configured.");
  } else {
    try {
      const gemini = getGenerationProvider();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 120000);
      timer.unref();
      const res = await gemini.generateJson(
        {
          system: SYSTEM_PROMPT_V1,
          user: `Summarize the source as JSON matching this schema: ${JSON.stringify(SummaryContentSchema)}\n<<<SOURCE title="Smoke Test">>>\n[c0 p1] การสังเคราะห์ด้วยแสง คือกระบวนการสร้างอาหารของพืช\n<<<END SOURCE>>>`,
          schema: SummaryContentSchema,
          schemaName: "SummaryContent",
        },
        { signal: controller.signal },
      );
      clearTimeout(timer);
      console.log(
        "   [PASSED] Generation call succeeded:",
        res.generation,
        (res.data as any).overview,
      );
    } catch (err: any) {
      console.error("   [FAILED] Generation call failed:", err.message);
      process.exitCode = 1;
    }
  }

  console.log("\nProvider verification check finished.");
}

verifyProviders();
