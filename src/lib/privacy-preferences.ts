import { PRIVACY_POLICY_VERSION } from "./contracts";

export const PRIVACY_COOKIE = "mode_privacy";
export const PRIVACY_CHANGE_EVENT = "mode:privacy-changed";
export const OPTIONAL_STORAGE_KEYS = ["mode-theme", "mode.announcement.draft"] as const;
export type PrivacyChoice = "essential" | "preferences";
// A failed cookie write must not keep optional storage enabled after withdrawal.
let essentialForThisPage = false;

export function parsePrivacyChoice(cookie: string): PrivacyChoice | null {
  const value = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${PRIVACY_COOKIE}=`))?.slice(PRIVACY_COOKIE.length + 1);
  if (value === `${PRIVACY_POLICY_VERSION}.essential`) return "essential";
  if (value === `${PRIVACY_POLICY_VERSION}.preferences`) return "preferences";
  return null;
}

export function getPrivacyChoice(): PrivacyChoice | null {
  try { return typeof document === "undefined" ? null : essentialForThisPage ? "essential" : parsePrivacyChoice(document.cookie); }
  catch { return null; }
}

export function clearOptionalPreferences(): void {
  for (const key of OPTIONAL_STORAGE_KEYS) {
    try { window.localStorage.removeItem(key); } catch { /* Storage may be unavailable. */ }
  }
}

export function savePrivacyChoice(choice: PrivacyChoice): boolean {
  if (typeof document === "undefined") return false;
  if (choice !== "essential" && choice !== "preferences") return false;
  if (choice === "essential") clearOptionalPreferences();
  try {
    document.cookie = `${PRIVACY_COOKIE}=${PRIVACY_POLICY_VERSION}.${choice}; Path=/; Max-Age=15552000; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
    const saved = parsePrivacyChoice(document.cookie) === choice;
    if (choice === "essential") essentialForThisPage = !saved;
    else if (saved) essentialForThisPage = false;
    window.dispatchEvent(new Event(PRIVACY_CHANGE_EVENT));
    return saved;
  } catch {
    if (choice === "essential") essentialForThisPage = true;
    window.dispatchEvent(new Event(PRIVACY_CHANGE_EVENT));
    return false;
  }
}

export function readOptionalPreference(key: typeof OPTIONAL_STORAGE_KEYS[number]): string | null {
  if (getPrivacyChoice() !== "preferences") return null;
  try { return window.localStorage.getItem(key); } catch { return null; }
}

export function writeOptionalPreference(key: typeof OPTIONAL_STORAGE_KEYS[number], value: string): void {
  if (getPrivacyChoice() !== "preferences") return;
  try { window.localStorage.setItem(key, value); } catch { /* Current-page controls still work. */ }
}
