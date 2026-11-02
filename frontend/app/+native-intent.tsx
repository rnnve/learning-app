/**
 * Normalize Expo Go launch URLs before Expo Router builds navigation state.
 * Some Expo Go/runtime combinations do not identify themselves early enough
 * for the router to strip its `/--/` transport separator automatically.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    if (path === "/--" || path === "/--/") return "/";
    const expoGoMatch = path.match(/^exps?:\/\/[^/]+\/--\/?(.*)$/);
    if (!expoGoMatch) return path;

    const appPath = expoGoMatch[1];
    return appPath ? `/${appPath}` : "/";
  } catch {
    return "/";
  }
}
