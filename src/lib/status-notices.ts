import { statusNoticesSchema, type StatusNotices } from "./status";

/** Public editorial content. See docs/STATUS.md before publishing an update. */
const notices: StatusNotices = {
  incidents: [],
  maintenance: [],
};

export function getStatusNotices(): StatusNotices {
  return statusNoticesSchema.parse(notices);
}
