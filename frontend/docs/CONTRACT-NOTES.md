# Contract Notes (Deviations & Clarifications)

This document records deviations from `opencode-frontend.txt` and constraints discovered while implementing against the backend.

## Onboarding order and auth flow
- **Observed**: `PUT /v1/me/consent` requires authentication (the backend enforces auth). 
- **Implementation**: the app creates a guest session on the language screen (before the consent screen). Flow: welcome → language → guest session (`POST /auth/guest`) → consent → `/(tabs)`. The contract's "guest-first" requirement is respected; consent is still required before normal use.
- **Rationale**: without an authenticated/guest session, the consent endpoint returns an auth error. This is necessary for the flow to work with the current backend.

## Consent behaviour
- **Observed**: `PUT /v1/me/consent` only accepts `aiProcessing: true` (the backend rejects attempts to decline/opt-out in the normal path). The UI does not present a "skip/decline" action for consent.
- **Implementation**: the consent screen has a single accept path (checkbox required, then accept). The "skip" action was removed.
- **Rationale**: a dead/invalid action was removed to avoid misleading the user and to match backend constraints.

## Error handling
- **Rule followed**: never show raw server `message` unless the error code is unmapped (contract §i18n). All mapped contract error codes use `errors.*` translations. `localizeError` / `localizeErrorBody` enforce this centrally. `Job.error` and `Source.error` (no `requestId`) are localized via `localizeErrorBody`.

## Uploads and idempotency
- **Multipart**: `FormData` parts for file uploads use `file://` URIs; `Content-Type` is not set manually (let the runtime attach the boundary). 
- **Idempotency**: `Idempotency-Key` and `clientMessageId` are client-generated UUIDs. They are reused on retry for the same action. The backend requires a valid UUID for `Idempotency-Key`.

## Job polling
- **Implementation**: 1500ms → 4000ms backoff after 30s, stop on terminal statuses (`succeeded`/`failed`/`canceled`). Polling invalidates relevant queries on completion.

## Other notes
- **Chat**: retry preserves the typed text and reuses the same `clientMessageId`/`Idempotency-Key`. The typing indicator is capped at 60s.
- **Settings**: delete-all-data requires typing `DELETE` in `ConfirmDialog` (`requiredConfirmText`) before the destructive action is enabled.
