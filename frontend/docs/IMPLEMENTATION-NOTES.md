# Implementation Notes

## Architecture

### Root layout and AuthProvider
- `app/_layout.tsx` splits into `RootLayout` (wraps the app in `<AuthProvider>`) and `AppShell` (consumes `useAuth()`). This fixes the `useAuth must be used within an AuthProvider` crash while keeping the navigation tree declarative.
- `src/auth/AuthProvider` remains the single source of truth for `user`, `isAuthenticated`, `isGuest`, `hasConsent`, tokens and guest session lifecycle.

### Navigation / routing
- Onboarding order: welcome (3-slide pager, Next/Skip) → language → guest session → consent → `/(tabs)`. Navigation uses `expo-router` with `router.replace`.
- Consent is a blocking step before accessing the app; the backend requires authentication for `PUT /v1/me/consent`, so a guest session is created on the language screen.
- `app/source/[id]/generate.tsx` navigates to `/material/${materialId}` on a successful generation job.
- Source image previews use `expo-image` with `sourceFileUrl()` + `authHeaders()`.

### API and networking
- `src/api/client.ts` normalises every failure into `ApiError` (status/code/message/retryable/requestId/details). Network/timeout errors become `NETWORK_ERROR` / `CLIENT_TIMEOUT`. The 401 path performs a single-flight refresh and retries once; auth errors trigger `onUnauthenticated` and token clearing.
- `src/api/errors.ts` provides `localizeError`, `localizeErrorBody` and `ApiError.getLocalizedMessage()`. **User-visible errors are never raw server messages unless the error code is unmapped** — all mapped codes use `errors.*` translations.
- `src/api/queryClient.ts` sets `shouldRetry` to avoid retrying non-retryable `4xx` (except 408/429). `src/api/endpoints/*` map to the contract paths.
- Multipart uploads (images/documents): `src/api/endpoints/sources.ts` constructs `FormData` parts from `file://` URIs and **does not** set `Content-Type` manually (the runtime sets the correct boundary).
- Idempotency: `Idempotency-Key` and `clientMessageId` are UUIDs generated via `src/lib/uuid.ts` (`generateUuid()`). They are reused on retry for the same action.
- Job polling: `src/features/sources/useJob.ts` polls at 1500ms, backs off to 4000ms after 30s and stops polling for terminal statuses. The query is invalidated on success/failure.

### i18n
- `src/i18n/index.ts` fixes the `ns`/`defaultNS`/`nsSeparator: "."` configuration (i18next v24 defaults broke dot-namespaced lookups). `th` is the default language.
- All user-visible strings go through `t()`. Enum namespaces cover `enums.*`, `errors.*` (all contract codes), `warnings.*`, `stages.*`, etc. The test suite enforces key parity between `th.json` and `en.json` and no empty values.

### UI components (testable and accessible)
- `src/components/ui/glassEffect.ts` extracts pure `selectGlassSurfaceVariant()` and `detectLiquidGlass()` (testable, no side effects). `GlassSurface` uses a 3-level fallback (liquid glass → blur → solid).
- `ChatBubble`, `QuizVerdict`, `RatingButtons` extracted for unit testing.
- `ErrorState` uses `localizeError()` and is accessible (`accessibilityRole="alert"`). `ProgressSteps`, `Banner` marked accessible where appropriate.
- `ConfirmDialog` supports `requiredConfirmText` for type-to-confirm flows (wired to Settings delete-all-data with `"DELETE"`).
- `src/components/ui/ChatBubble.tsx` supports delivery states `sent`/`sending`/`failed` with a Retry action; `testID="chat-bubble-retry"` exposed for tests.

### Chat flow (hardened)
- `app/chat/[conversationId].tsx`: optimistic user bubble with `sending` state, typing indicator capped at 60s, failure keeps the typed text and shows a failed bubble with Retry. Retry reuses the same `clientMessageId` and `Idempotency-Key`. Both IDs are UUIDs (the backend rejects non-UUID idempotency keys).
- Messages are loaded and reversed as returned by `getMessages`.

### Settings / destructive actions
- `app/(tabs)/settings.tsx`: delete-all-data uses `ConfirmDialog` with `requiredConfirmText="DELETE"`, calls `deleteMe()` then `signOut()`, navigates back to `/(onboarding)/welcome`.

### Testing
- Jest + `jest-expo` + React Native Testing Library v14. `jest.setup.js` registers RNTL matchers. `setupFilesAfterEnv` is used (typo fixed from `setupFilesAfterEach`).
- `tsconfig.json` sets `"moduleDetection": "auto"`, includes `"types": ["jest","node","react"]` and does not exclude `__tests__/**`.
- Flows tested: onboarding, chat (send/retry/UUIDs), source processing/preview, generate → material, material rendering (summary/flashcards/quiz), delete-all-data confirmation.
- All quality gates pass: `biome check .`, `tsc --noEmit`, `jest --ci`.
