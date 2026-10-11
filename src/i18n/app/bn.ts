import type { AppDictionary } from "./en";
import common from "./bn/common";
import shell from "./bn/shell";
import auth from "./bn/auth";
import overview from "./bn/overview";
import members from "./bn/members";
import events from "./bn/events";
import tickets from "./bn/tickets";
import shop from "./bn/shop";
import announcements from "./bn/announcements";
import tasks from "./bn/tasks";
import expenses from "./bn/expenses";
import treasury from "./bn/treasury";
import pass from "./bn/pass";
import notifications from "./bn/notifications";
import settings from "./bn/settings";

/** Bengali (বাংলা) dictionary for the /app workspace. Keys mirror en.ts exactly. */
const bn: AppDictionary = {
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

export default bn;
