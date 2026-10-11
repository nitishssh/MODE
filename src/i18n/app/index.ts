import type { Locale } from "../locales";
import type { AppDictionary } from "./en";

export type { AppDictionary, AppKey } from "./en";

/**
 * One lazy loader per language, like the legacy workspace: a request only
 * loads the dictionary it renders and only that one reaches the browser.
 * Languages without a finished translation fall back to English so a missing
 * file can never break the workspace.
 */
const loaders: Partial<Record<Locale, () => Promise<{ default: AppDictionary }>>> = {
  en: () => import("./en"),
  hi: () => import("./hi"),
  bn: () => import("./bn"),
  mr: () => import("./mr"),
  te: () => import("./te"),
  ta: () => import("./ta"),
  gu: () => import("./gu"),
  ur: () => import("./ur"),
  kn: () => import("./kn"),
  ml: () => import("./ml"),
  pa: () => import("./pa"),
  as: () => import("./as"),
};

export async function getAppDictionary(locale: Locale): Promise<AppDictionary> {
  const load = loaders[locale] ?? loaders.en!;
  try {
    return (await load()).default;
  } catch {
    return (await loaders.en!()).default;
  }
}
