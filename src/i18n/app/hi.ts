import type { AppDictionary } from "./en";
import common from "./hi/common";
import shell from "./hi/shell";
import auth from "./hi/auth";
import overview from "./hi/overview";
import members from "./hi/members";
import events from "./hi/events";
import tickets from "./hi/tickets";
import shop from "./hi/shop";
import announcements from "./hi/announcements";
import tasks from "./hi/tasks";
import expenses from "./hi/expenses";
import treasury from "./hi/treasury";
import pass from "./hi/pass";
import notifications from "./hi/notifications";
import settings from "./hi/settings";

/** Hindi (हिन्दी) dictionary for the /app workspace. Keys mirror en.ts exactly. */
const hi: AppDictionary = {
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

export default hi;
