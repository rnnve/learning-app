import { QueryClient, focusManager } from "@tanstack/react-query";
import { AppState, type AppStateStatus } from "react-native";
import { ApiError } from "./errors";

/**
 * Contract Section 7: retry GETs twice, but never retry a 4xx that is not
 * 429 (rate limited) or 408 (timeout) - those need a fresh user action.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError) {
    if (error.status === 429 || error.status === 408) {
      return failureCount < 2;
    }
    if (error.status >= 400 && error.status < 500) {
      return false;
    }
  }
  return failureCount < 2;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: shouldRetry,
        refetchOnReconnect: true,
        // The platform has no window focus event; AppState "active" is the
        // equivalent (contract Section 7).
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Maps AppState -> React Query's focusManager so that returning to the app
 * refetches stale queries.
 */
export function setupFocusManager(): () => void {
  const subscription = AppState.addEventListener("change", (status: AppStateStatus) => {
    focusManager.setFocused(status === "active");
  });
  return () => subscription.remove();
}
