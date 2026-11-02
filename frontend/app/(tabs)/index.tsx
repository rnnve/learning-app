import { Redirect } from "expo-router";

/** Defensive entry point for links that target the route group itself. */
export default function TabsIndex() {
  return <Redirect href="/(tabs)/home" />;
}
