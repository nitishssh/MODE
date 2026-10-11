import type { AppDictionary } from "./en";
import common from "./te/common";
import shell from "./te/shell";
import auth from "./te/auth";
import overview from "./te/overview";
import members from "./te/members";
import events from "./te/events";
import tickets from "./te/tickets";
import shop from "./te/shop";
import announcements from "./te/announcements";
import tasks from "./te/tasks";
import expenses from "./te/expenses";
import treasury from "./te/treasury";
import pass from "./te/pass";
import notifications from "./te/notifications";
import settings from "./te/settings";

/** Telugu (తెలుగు) dictionary for the /app workspace. Keys mirror en.ts exactly. */
const te: AppDictionary = {
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

export default te;
