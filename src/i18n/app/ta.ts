import type { AppDictionary } from "./en";
import common from "./ta/common";
import shell from "./ta/shell";
import auth from "./ta/auth";
import overview from "./ta/overview";
import members from "./ta/members";
import events from "./ta/events";
import tickets from "./ta/tickets";
import shop from "./ta/shop";
import announcements from "./ta/announcements";
import tasks from "./ta/tasks";
import expenses from "./ta/expenses";
import treasury from "./ta/treasury";
import pass from "./ta/pass";
import notifications from "./ta/notifications";
import settings from "./ta/settings";

/** Tamil (தமிழ்) dictionary for the /app workspace. Keys mirror en.ts exactly. */
const ta: AppDictionary = {
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

export default ta;
