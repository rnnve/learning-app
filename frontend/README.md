# Thai AI Study — Frontend (Expo / React Native)

This is the Expo/React Native frontend for **Thai AI Study**. The project uses **Bun** as the package manager, **Biome** for lint/format (no ESLint/Prettier), and **TanStack Query** for server state.

## Prerequisites
- [Bun](https://bun.sh/) installed
- Node.js (compatible with the Expo SDK version in `package.json`)
- (Optional) Expo CLI / EAS CLI

## Getting started
```bash
bun install
bun start        # start Expo dev server
bun run android  # run on Android
bun run ios      # run on iOS
bun run web      # run on web
```

## Scripts
```bash
bun run lint     # biome check .
bun run format   # biome format --write .
bun run typecheck
bun test         # jest
```

## Quality gates (must pass)
```bash
npx biome check .
npx tsc --noEmit
npx jest --ci
npx expo-doctor
npx expo export --platform android --output-dir /tmp/export-check
```

## Environment
Set `EXPO_PUBLIC_API_URL` to point at the backend (defaults to `http://127.0.0.1:3000`). In an
Expo development build, a loopback host is automatically replaced with Metro's LAN host so a
physical phone can reach the backend. Explicit LAN and production URLs are never rewritten.

## Architecture highlights
- **Auth**: guest-first flow with `AuthProvider`. Consent required before use; a guest session is created before consent because `PUT /v1/me/consent` is authenticated.
- **i18n**: Thai default, English available. All user-visible strings go through `t()`. Error codes are mapped in `errors.*`.
- **Networking**: Axios client normalises errors to `ApiError`, does single-flight token refresh, adds `Accept-Language` and `X-Request-Id`. Multipart uploads do not set `Content-Type` manually.
- **Jobs**: TanStack Query polling with 1500ms → 4000ms backoff after 30s, stopping on terminal statuses.
- **UI**: `GlassSurface` with graceful fallbacks, accessible components, no hard-coded user-visible strings.

## Documentation
- `docs/IMPLEMENTATION-NOTES.md` — architecture, flows, and implementation details
- `docs/CONTRACT-NOTES.md` — deviations from `opencode-frontend.txt` and backend constraints
- `docs/LIMITATIONS.md` — what was not verified in this environment
