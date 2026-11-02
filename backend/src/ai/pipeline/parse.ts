import type { TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { AppError } from "../../lib/errors.ts";
import type { GenerationProvider } from "../providers/types.ts";

export async function parseAndValidateWithRepair<T>(
  raw: string,
  schema: TSchema,
  schemaName: string,
  repairProvider: GenerationProvider | null,
  signal: AbortSignal,
): Promise<T> {
  const cleaned = cleanJsonString(raw);

  try {
    const parsed = JSON.parse(cleaned);
    if (Value.Check(schema, parsed)) {
      return parsed as T;
    }

    const errors = [...Value.Errors(schema, parsed)].map((e) => `${e.path}: ${e.message}`);

    if (!repairProvider) {
      throw new AppError("AI_OUTPUT_INVALID", {
        message: `Model output did not match schema: ${errors.join("; ")}`,
        details: { errors },
      });
    }

    // Attempt ONE repair call with error paths
    const repairPrompt = `The previous JSON output failed validation against the schema (${schemaName}):\n${errors.join("\n")}\nPlease correct the JSON and return ONLY the valid JSON object. No explanation or markdown fences.`;

    const repairRes = await repairProvider.generateJson<T>(
      {
        system: "You are a JSON repair specialist. Output only valid JSON matching the schema.",
        user: `${repairPrompt}\n\nInvalid JSON was:\n${cleaned.slice(0, 4000)}`,
        schema,
        schemaName,
      },
      { signal },
    );

    return repairRes.data;
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    throw new AppError("AI_OUTPUT_INVALID", {
      message: `Failed to parse AI output: ${err.message}`,
    });
  }
}

function cleanJsonString(raw: string): string {
  let text = raw.trim();
  const codeFenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeFenceMatch) {
    text = codeFenceMatch[1].trim();
  }
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return text.substring(first, last + 1);
  }
  return text;
}
