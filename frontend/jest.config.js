module.exports = {
  preset: "jest-expo",
  transformIgnorePatterns: [
    "node_modules/(?!(react-native|@react-native|@expo|expo|expo-router|nativewind|@react-navigation|@gorhom|react-native-paper|react-native-css-interop|react-native-screens|react-native-safe-area-context|react-native-gesture-handler|react-native-reanimated|expo-modules-core)/)",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@/components/(.*)$": "<rootDir>/src/components/$1",
    "^@/lib/(.*)$": "<rootDir>/src/lib/$1",
    "^@/hooks/(.*)$": "<rootDir>/src/hooks/$1",
    "^@/stores/(.*)$": "<rootDir>/src/stores/$1",
    "^@/types/(.*)$": "<rootDir>/src/types/$1",
    "^@/assets/(.*)$": "<rootDir>/src/assets/$1",
    "^@/features/(.*)$": "<rootDir>/src/features/$1",
    "^@/api/(.*)$": "<rootDir>/src/api/$1",
    "^@/i18n/(.*)$": "<rootDir>/src/i18n/$1",
    "^@/auth/(.*)$": "<rootDir>/src/auth/$1",
    "^@/theme/(.*)$": "<rootDir>/src/theme/$1",
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testPathIgnorePatterns: ["/node_modules/", "/.expo/"],
  collectCoverageFrom: ["src/**/*.{ts,tsx}", "!src/**/*.d.ts", "!src/**/*.test.{ts,tsx}"],
};
