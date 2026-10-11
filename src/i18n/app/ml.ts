import type { AppDictionary } from "./en";
import common from "./ml/common";
import shell from "./ml/shell";
import auth from "./ml/auth";
import overview from "./ml/overview";
import members from "./ml/members";
import events from "./ml/events";
import tickets from "./ml/tickets";
import shop from "./ml/shop";
import announcements from "./ml/announcements";
import tasks from "./ml/tasks";
import expenses from "./ml/expenses";
import treasury from "./ml/treasury";
import pass from "./ml/pass";
import notifications from "./ml/notifications";
import settings from "./ml/settings";

/** Malayalam (മലയാളം) dictionary for the /app workspace. Keys mirror en.ts exactly. */
const ml: AppDictionary = {
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

export default ml;
