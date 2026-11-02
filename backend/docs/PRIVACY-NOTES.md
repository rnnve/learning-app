# Privacy & PDPA Notes

## Consent Requirements
- Thai Personal Data Protection Act (PDPA) compliance requires explicit user consent before user documents and chats are sent to third-party AI providers (Google Gemini, Nemotron vision).
- Endpoint: `PUT /v1/me/consent` records `aiProcessing: true`, the accepted `version`, and ISO timestamp.
- Consent gate is enforced at `POST /v1/sources`, `POST /v1/materials`, `POST /v1/conversations/:id/messages`, and short-answer grading.
- Missing consent returns `403 CONSENT_REQUIRED`.

## Data Deletion & Retention
- Single source deletion (`DELETE /v1/sources/:id`) removes all source files and metadata.
- Account deletion (`DELETE /v1/me`) cascades and deletes all database rows and stored files under `users/<userId>/`.
- Logs never contain document contents, extracted text, prompts, AI completions, tokens, or credentials.
