// Mock expo modules
jest.mock("expo-constants", () => ({
  expoConfig: {
    extra: {
      apiUrl: "http://localhost:8080",
    },
  },
}));

jest.mock("expo-localization", () => ({
  getLocales: () => [{ languageTag: "th-TH" }],
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
}));

// NetInfo has no native module in Jest - always report an online device.
jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => jest.fn()),
    fetch: jest.fn().mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
      type: "wifi",
    }),
    configure: jest.fn(),
  },
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn().mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
    type: "wifi",
  }),
}));

jest.mock("expo-image-manipulator", () => ({
  manipulateAsync: jest.fn().mockResolvedValue({
    uri: "file:///mock/prepared.jpg",
    width: 1024,
    height: 768,
    base64: "",
  }),
  SaveFormat: { JPEG: "jpeg", PNG: "png", WEBP: "webp" },
}));

jest.mock("expo-file-system", () => ({
  File: jest.fn().mockImplementation((uri) => ({ uri, size: 1024 })),
  Directory: jest.fn(),
  Paths: { cache: { uri: "file:///cache/" }, document: { uri: "file:///docs/" } },
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

jest.mock("expo-blur", () => ({
  BlurView: "BlurView",
}));

jest.mock("react-native/Libraries/EventEmitter/NativeEventEmitter");

// React Native Testing Library matchers (toHaveStyle, toBeOnTheScreen, ...)
require("@testing-library/react-native/matchers");

// Silence console warnings in tests
const originalWarn = console.warn;
console.warn = (...args) => {
  if (args[0]?.includes?.("useExhaustiveDependencies")) return;
  if (args[0]?.includes?.("noArrayIndexKey")) return;
  originalWarn.apply(console, args);
};

const originalError = console.error;
console.error = (...args) => {
  if (args[0]?.includes?.("Warning:")) return;
  originalError.apply(console, args);
};
