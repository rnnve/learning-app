# Backend Implementation Notes

## Architecture Overview
- Bun 1.4+ runtime and ElysiaJS 1.4+ REST API.
- PostgreSQL 16+ via Drizzle ORM and `postgres` driver.
- TypeBox schemas as single source of truth for request/response validation, OpenAPI spec generation, and AI output validation.
- Database-backed job queue with `SELECT ... FOR UPDATE SKIP LOCKED` and leasing for asynchronous background jobs.
- Local disk storage abstraction using server-generated keys (`users/<userId>/sources/<sourceId>/<uuid>.<ext>`).
- Dual AI provider architecture: Nemotron (OpenAI-compatible) for document vision OCR, Gemini for structured educational content generation.
- BM25 chunk retrieval with Intl.Segmenter Thai word segmentation for study chat.
- Guest accounts with upgrade-in-place registration.
- Leitner spaced repetition with 5 boxes for flashcards.

## Project Structure
- `src/config/`: Environment validation.
- `src/db/`: Drizzle schema and client.
- `src/plugins/`: Error handler, auth, idempotency, rate limiting, OpenAPI.
- `src/routes/`: Route controllers matching contract v1.
- `src/services/`: Core business logic with user isolation.
- `src/ai/`: Providers (Nemotron, Gemini, Fake), prompts, schemas, parsing and post-processing pipeline.
- `src/processing/`: Magic-byte sniffing, sharp image normalization, PDF/DOCX parsing, chunker, retrieval.
- `src/worker/`: Async job queue worker and task handlers.
- `src/storage/`: Local disk storage provider.
- `src/lib/`: Errors, IDs, hashing, logging.
