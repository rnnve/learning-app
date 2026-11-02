# AI Providers Specification & Verification

## 1. Vision Extraction: NeMo Retriever OCR v1
- Select with `NEMOTRON_MODEL=nemoretriever-ocr-v1`.
- Set `NEMOTRON_BASE_URL=https://ai.api.nvidia.com/v1/cv/nvidia/nemoretriever-ocr` (full inference URL).
- Auth: Bearer token from `NEMOTRON_API_KEY`
- Image Input: `{ input: [{ type: "image_url", url: "data:<mime>;base64,..." }], merge_levels: ["paragraph"] }`.
- Output Handling: Converts `data[0].text_detections[].text_prediction` into paragraph blocks in provider order; detects language locally and estimates legibility from confidence scores.
- The legacy Nemotron chat-completions adapter remains available when another `NEMOTRON_MODEL` is selected.
- NVIDIA lists the v1 service as deprecated; the hosted endpoint passed the live smoke test during this update.
- Verification Status:
  - Live test uses a generated image with known text and verifies that text is recovered.
  - Local tests cover request format, output conversion, malformed results, and cancellation.

## 2. Study Content Generation: Gemini
- Gemini is tried first for summaries, flashcards, quizzes, grading, and chat. After an availability/configuration error, or a 30-second primary deadline, requests fall back to NVIDIA `nvidia/nemotron-3.5-lightning-30b-a3b`.
- Cancellation, blocked content, and invalid output do not trigger fallback.
- Fallback uses `NEMOTRON_GENERATION_BASE_URL` (default `https://integrate.api.nvidia.com/v1`), `NEMOTRON_GENERATION_MODEL`, and `NEMOTRON_GENERATION_API_KEY` or the existing `NEMOTRON_API_KEY`.
- `GENERATION_PRIMARY_TIMEOUT_MS` controls the Gemini deadline; `NEMOTRON_GENERATION_TIMEOUT_MS` controls the fallback deadline (60 seconds by default). OCR keeps its separate endpoint.
- Generated materials record the provider and model that actually succeeded.
- Target Model Family: Google Gemini (`GEMINI_MODEL=gemini-3.8-flash`)
- Interface: `@google/genai` SDK or REST fallback
- JSON Mode: `responseMimeType: "application/json"` with schema
- System Prompt: Versioned tutor prompt `system.v1` ("น้องติว")
- Verification Status:
  - Run `bun run verify:providers` to check the configured live model and key.
  - The adapter is fully implemented with JSON structured output, AbortSignal timeout, error mapping, and TypeBox validation.
  - A comprehensive `FakeProvider` is provided for tests and local dev mode (`AI_MODE=fixture`).
