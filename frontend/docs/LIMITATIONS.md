# Limitations

## Not verified in this environment
- **Device / Expo Go testing**: no physical device or Expo Go runtime was used. UI flows were validated via React Native Testing Library component/flow tests and TypeScript/biome checks.
- **Native builds**: `expo prebuild` / EAS builds were not run. Native module behaviour (haptics, secure store, image picker, document picker) is mocked in tests.
- **Network integration**: no live backend calls were made. All API interactions are mocked in tests; the axios client and interceptors are unit-tested separately where possible.
- **Camera / file system**: image capture and document picking rely on Expo modules; behaviour unverified on device.
- **Liquid Glass**: `expo-glass-effect` is present; availability detection falls back gracefully, but actual glass rendering not visually verified.

## Known gaps / tradeoffs
- **Error strings**: arbitrary non-key strings passed to `ErrorState` are mapped to the generic fallback per contract ("never show raw server message unless the code is unmapped"). Screens that previously showed raw `err.message` were updated to pass the error object or a mapped key.
- **Polling lifecycle**: job polling is query-based via TanStack Query; background/foreground behaviour follows the library defaults.
- **Offline**: basic network awareness exists via NetInfo mocking in tests; full offline flows not exhaustively verified.
