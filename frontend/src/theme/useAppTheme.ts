import { useTheme } from "react-native-paper";
import type { AppTheme } from "./paperTheme";

export type { AppTheme } from "./paperTheme";

export function useAppTheme(): AppTheme {
  return useTheme<AppTheme>();
}
