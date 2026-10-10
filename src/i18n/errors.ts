import type { Dictionary, DictionaryKey } from "./dictionaries/en";

// Codes identify error families; a custom server message can explain a more
// specific failure (bad credentials, an empty receipt, or a prohibited action).
const genericMessages: Record<string, string> = {
  unauthenticated: "Sign in to continue.",
  forbidden: "You are not allowed to perform this action.",
  not_found: "The requested record was not found.",
  validation_failed: "Please check the submitted fields.",
  duplicate_member: "A member with this email address already exists.",
  server: "Something went wrong. Please try again.",
};

export function translateApiError(
  dict: Dictionary,
  result: { error?: string; code?: string } | null | undefined,
  fallback: DictionaryKey,
): string {
  const code = result?.code;
  if (code && Object.hasOwn(genericMessages, code)) {
    const key = `errors.${code}` as DictionaryKey;
    if (!result?.error || result.error === genericMessages[code]) return dict[key];
  }
  return result?.error || dict[fallback];
}
