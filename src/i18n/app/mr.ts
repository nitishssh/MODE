import type { AppDictionary } from "./en";
import common from "./mr/common";
import shell from "./mr/shell";
import auth from "./mr/auth";
import overview from "./mr/overview";
import members from "./mr/members";
import events from "./mr/events";
import tickets from "./mr/tickets";
import shop from "./mr/shop";
import announcements from "./mr/announcements";
import tasks from "./mr/tasks";
import expenses from "./mr/expenses";
import treasury from "./mr/treasury";
import pass from "./mr/pass";
import notifications from "./mr/notifications";
import settings from "./mr/settings";

/** Marathi (मराठी) dictionary for the /app workspace. Keys mirror en.ts exactly. */
const mr: AppDictionary = {
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

export default mr;
