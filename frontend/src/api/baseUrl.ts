const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

/**
 * Return the host part of Expo's development server URI.
 *
 * Expo commonly reports values such as `192.168.1.12:8081`; accepting a full
 * URL as well keeps this helper compatible with development-client manifests.
 */
export function expoDevelopmentHost(hostUri: string | null | undefined): string | null {
  if (!hostUri) return null;

  try {
    const parsed = new URL(hostUri.includes("://") ? hostUri : `http://${hostUri}`);
    return parsed.hostname || null;
  } catch {
    return null;
  }
}

/**
 * A phone cannot use the computer's loopback interface. During Expo
 * development, rewrite only loopback API URLs to the machine serving Metro.
 * Explicit LAN and production URLs are always preserved.
 */
export function resolveApiBaseUrl(
  configuredUrl: string,
  options: { isDevelopment: boolean; expoHostUri?: string | null },
): string {
  const normalized = configuredUrl.replace(/\/$/, "");
  if (!options.isDevelopment) return normalized;

  try {
    const apiUrl = new URL(normalized);
    if (!LOOPBACK_HOSTS.has(apiUrl.hostname)) return normalized;

    const developmentHost = expoDevelopmentHost(options.expoHostUri);
    if (!developmentHost || LOOPBACK_HOSTS.has(developmentHost)) return normalized;

    apiUrl.hostname = developmentHost;
    return apiUrl.toString().replace(/\/$/, "");
  } catch {
    return normalized;
  }
}
