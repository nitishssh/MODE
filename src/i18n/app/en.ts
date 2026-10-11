/**
 * English master dictionary for the /app workspace. The legacy workspace keeps
 * its own dictionary in `../dictionaries`; this one is assembled from one
 * fragment per screen group so screens can be worked on independently.
 * Every other language file in this folder must provide exactly these keys
 * (enforced by the `AppDictionary` type and tests/app-i18n.test.ts).
 *
 * Conventions match the legacy dictionary: `{placeholders}` are kept verbatim,
 * "MODE" is never translated, digits stay Latin.
 */
import common from "./en/common";
import shell from "./en/shell";
import auth from "./en/auth";
import overview from "./en/overview";
import members from "./en/members";
import events from "./en/events";
import tickets from "./en/tickets";
import shop from "./en/shop";
import announcements from "./en/announcements";
import tasks from "./en/tasks";
import expenses from "./en/expenses";
import treasury from "./en/treasury";
import pass from "./en/pass";
import notifications from "./en/notifications";
import settings from "./en/settings";

const en = {
  ...common,
  ...shell,
  ...auth,
  ...overview,
  ...members,
  ...events,
  ...tickets,
  ...shop,
  ...announcements,
  ...tasks,
  ...expenses,
  ...treasury,
  ...pass,
  ...notifications,
  ...settings,
} as const;

export type AppKey = keyof typeof en;
export type AppDictionary = Record<AppKey, string>;

export default en as AppDictionary;
