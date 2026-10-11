import type { AppDictionary } from "./en";
import common from "./kn/common";
import shell from "./kn/shell";
import auth from "./kn/auth";
import overview from "./kn/overview";
import members from "./kn/members";
import events from "./kn/events";
import tickets from "./kn/tickets";
import shop from "./kn/shop";
import announcements from "./kn/announcements";
import tasks from "./kn/tasks";
import expenses from "./kn/expenses";
import treasury from "./kn/treasury";
import pass from "./kn/pass";
import notifications from "./kn/notifications";
import settings from "./kn/settings";

/** Kannada (ಕನ್ನಡ) dictionary for the /app workspace. Keys mirror en.ts exactly. */
const kn: AppDictionary = {
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

export default kn;
