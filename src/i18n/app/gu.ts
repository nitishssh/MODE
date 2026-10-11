import type { AppDictionary } from "./en";
import common from "./gu/common";
import shell from "./gu/shell";
import auth from "./gu/auth";
import overview from "./gu/overview";
import members from "./gu/members";
import events from "./gu/events";
import tickets from "./gu/tickets";
import shop from "./gu/shop";
import announcements from "./gu/announcements";
import tasks from "./gu/tasks";
import expenses from "./gu/expenses";
import treasury from "./gu/treasury";
import pass from "./gu/pass";
import notifications from "./gu/notifications";
import settings from "./gu/settings";

/** Gujarati (ગુજરાતી) dictionary for the /app workspace. Keys mirror en.ts exactly. */
const gu: AppDictionary = {
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

export default gu;
