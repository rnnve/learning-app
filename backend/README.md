# Thai AI Study - Backend API

Production ElysiaJS + Bun API for the Thai AI Study application.

## Prerequisites
- [Bun](https://bun.sh/) 1.2+ (or Docker Compose)
- PostgreSQL 16+

## Quick Start (Docker Compose)
1. Copy environment template:
   ```bash
   cp .env.example .env
   ```
2. Generate a secure JWT secret:
   ```bash
   openssl rand -base64 48
   ```
   Paste the generated secret into `JWT_SECRET` in `.env`.
3. Add AI provider credentials in `.env`:
   - `GEMINI_API_KEY` and `GEMINI_MODEL` (e.g. `gemini-2.5-flash`)
   - `NEMOTRON_BASE_URL` and `NEMOTRON_API_KEY` (for vision OCR)
   *(If keys are omitted, the API runs with AI endpoints returning 503 AI_NOT_CONFIGURED or AI_MODE=fixture in dev)*
4. Start with Docker Compose:
   ```bash
   docker compose up -d --build
   ```
5. Check health:
   ```bash
   curl -fsS http://localhost:3000/health
   curl -fsS http://localhost:3000/ready
   ```
6. Open Swagger API documentation:
   [http://localhost:3000/docs](http://localhost:3000/docs)

## Local Development (Bun directly)
1. Install dependencies:
   ```bash
   bun install --frozen-lockfile
   ```
2. Run database migrations:
   ```bash
   bun run db:migrate
   ```
3. Start the dev server:
   ```bash
   bun run dev
   ```

## Testing & Quality Gates
```bash
bun run check       # runs Biome check, TypeScript check, and bun test
bun test            # runs all unit & integration tests
bun run lint        # runs Biome linter
bun run format      # formats code with Biome
```
