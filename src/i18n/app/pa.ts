import type { AppDictionary } from "./en";
import common from "./pa/common";
import shell from "./pa/shell";
import auth from "./pa/auth";
import overview from "./pa/overview";
import members from "./pa/members";
import events from "./pa/events";
import tickets from "./pa/tickets";
import shop from "./pa/shop";
import announcements from "./pa/announcements";
import tasks from "./pa/tasks";
import expenses from "./pa/expenses";
import treasury from "./pa/treasury";
import pass from "./pa/pass";
import notifications from "./pa/notifications";
import settings from "./pa/settings";

/** Punjabi (ਪੰਜਾਬੀ) dictionary for the /app workspace. Keys mirror en.ts exactly. */
const pa: AppDictionary = {
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
};

export default pa;
