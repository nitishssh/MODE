export class ApiUrlConfigurationError extends Error {}

/**
 * Resolves the public base URL used by a future Expo client. Browser MODE is
 * same-origin and deliberately uses relative /api URLs instead.
 */
export function resolveExpoApiUrl(value = process.env.EXPO_PUBLIC_API_URL): string {
  const configured = value?.trim();
  if (!configured) return "http://127.0.0.1:3000";

  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new ApiUrlConfigurationError("EXPO_PUBLIC_API_URL must be an absolute http(s) URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ApiUrlConfigurationError("EXPO_PUBLIC_API_URL must use http or https.");
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new ApiUrlConfigurationError("EXPO_PUBLIC_API_URL must be an origin without a path, query, or hash.");
  }
  return url.origin;
}

export function apiUrl(path: string, baseUrl = resolveExpoApiUrl()): string {
  if (!path.startsWith("/")) throw new ApiUrlConfigurationError("API paths must begin with '/'.");
  return new URL(path, `${baseUrl}/`).toString();
}
