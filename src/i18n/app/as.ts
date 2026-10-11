import type { AppDictionary } from "./en";
import common from "./as/common";
import shell from "./as/shell";
import auth from "./as/auth";
import overview from "./as/overview";
import members from "./as/members";
import events from "./as/events";
import tickets from "./as/tickets";
import shop from "./as/shop";
import announcements from "./as/announcements";
import tasks from "./as/tasks";
import expenses from "./as/expenses";
import treasury from "./as/treasury";
import pass from "./as/pass";
import notifications from "./as/notifications";
import settings from "./as/settings";

/** Assamese (অসমীয়া) dictionary for the /app workspace. Keys mirror en.ts exactly. */
const as: AppDictionary = {
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

export default as;
