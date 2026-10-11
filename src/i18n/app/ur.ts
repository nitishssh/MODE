import type { AppDictionary } from "./en";
import common from "./ur/common";
import shell from "./ur/shell";
import auth from "./ur/auth";
import overview from "./ur/overview";
import members from "./ur/members";
import events from "./ur/events";
import tickets from "./ur/tickets";
import shop from "./ur/shop";
import announcements from "./ur/announcements";
import tasks from "./ur/tasks";
import expenses from "./ur/expenses";
import treasury from "./ur/treasury";
import pass from "./ur/pass";
import notifications from "./ur/notifications";
import settings from "./ur/settings";

/** Urdu (اردو) dictionary for the /app workspace. Keys mirror en.ts exactly. */
const ur: AppDictionary = {
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

export default ur;
