import type { Locale } from "../locales";
import type { Dictionary } from "./en";

export type { Dictionary, DictionaryKey } from "./en";

/**
 * One lazy loader per language so a request only ever loads the dictionary it
 * renders. Dictionaries are read on the server (root layout) and handed to the
 * client provider as props, so none of them ship in the browser bundle.
 */
const loaders: Record<Locale, () => Promise<{ default: Dictionary }>> = {
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

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return (await loaders[locale]()).default;
}
