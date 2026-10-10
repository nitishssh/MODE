import type { ReactNode, SVGProps } from "react";

/**
 * The workspace icon set. The first group is Azman's original set from the
 * legacy workspace (same paths, same 1.65 stroke); the rest extend it in the
 * same style for screens the legacy workspace did not have.
 */
export type IconName =
  | "grid" | "people" | "calendar" | "megaphone" | "bag" | "check" | "wallet" | "arrow" | "plus" | "close" | "chevron"
  | "filter" | "download" | "upload" | "clock" | "alert" | "receipt" | "coin" | "search" | "sun" | "moon"
  | "qr" | "scan" | "bell" | "settings" | "logout" | "ticket" | "refresh" | "back" | "edit" | "eye" | "external"
  | "trend" | "door" | "key" | "shield" | "info" | "mail" | "menu" | "checkbox";

const PATHS: Record<IconName, ReactNode> = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  people: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 4v2" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 11h18m-14 5h3" /></>,
  megaphone: <path d="M3 10v5h5l11 5V4L8 10H3Zm5 5 2 6h3l-2-5M22 9v6" />,
  bag: <><path d="M5 8h14l2 13H3L5 8Z" /><path d="M8 9V6a4 4 0 0 1 8 0v3" /></>,
  check: <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="m7 12 3 3 7-7" /></>,
  wallet: <path d="M21 8V6a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h16v11H5a3 3 0 0 1-3-3V7M21 13h-5v4h5" />,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  filter: <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>,
  upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
  alert: <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
  receipt: <><polyline points="8 3 4 3 4 21 20 21 20 3 16 3" /><rect x="8" y="3" width="8" height="4" rx="1" ry="1" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" /></>,
  coin: <><circle cx="12" cy="12" r="10" /><path d="M12 6v2m0 8v2M8 12h8" /><path d="M14.5 9.5A2.5 2.5 0 0 0 12 7a2.5 2.5 0 0 0 0 5 2.5 2.5 0 0 0 0 5 2.5 2.5 0 0 0 2.5-2.5" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 5 5" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></>,
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />,
  qr: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14v2M17 20h3M20 18v3" /></>,
  scan: <><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><path d="M4 12h16" /></>,
  bell: <><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>,
  ticket: <><path d="M3 9a2 2 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a2 2 0 0 1 0-6V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1z" /><path d="M13 5v14" strokeDasharray="2 2" /></>,
  refresh: <><path d="M20 12a8 8 0 1 1-2.3-5.7" /><path d="M20 4v5h-5" /></>,
  back: <path d="M19 12H5M11 18l-6-6 6-6" />,
  edit: <><path d="m4 20 4-1 11-11-3-3L5 16z" /><path d="m13 7 3 3" /></>,
  eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  external: <path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />,
  trend: <><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></>,
  door: <><path d="M5 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17" /><path d="M3 21h18M13 12h.01" /></>,
  key: <><circle cx="8" cy="14" r="4" /><path d="m11 11 9-9M16 6l2 2M13 9l2 2" /></>,
  shield: <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  checkbox: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m8.5 12.5 2.5 2.5 5-5" /></>,
};

/** Same signature as the legacy workspace's Icon: `<Icon name="grid" size={18} />`. */
export function Icon({ name, size = 20, ...rest }: { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg aria-hidden="true" className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" {...rest}>
      {PATHS[name]}
    </svg>
  );
}
