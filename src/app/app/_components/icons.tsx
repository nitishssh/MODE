import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, ...props };
}

export const Icon = {
  grid: (p: IconProps) => <svg {...base(p)}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>,
  people: (p: IconProps) => <svg {...base(p)}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17" cy="9" r="2.5" /><path d="M16 15.5a5 5 0 0 1 5.5 4.5" /></svg>,
  calendar: (p: IconProps) => <svg {...base(p)}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>,
  ticket: (p: IconProps) => <svg {...base(p)}><path d="M3 9a2 2 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a2 2 0 0 1 0-6V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1z" /><path d="M13 5v14" strokeDasharray="2 2" /></svg>,
  megaphone: (p: IconProps) => <svg {...base(p)}><path d="M3 10v4a1 1 0 0 0 1 1h3l6 4V5L7 9H4a1 1 0 0 0-1 1z" /><path d="M17 9a3 3 0 0 1 0 6M19.5 6.5a7 7 0 0 1 0 11" /></svg>,
  bag: (p: IconProps) => <svg {...base(p)}><path d="M5 8h14l-1 12H6z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>,
  check: (p: IconProps) => <svg {...base(p)}><path d="M5 12.5 10 17l9-10" /></svg>,
  checkbox: (p: IconProps) => <svg {...base(p)}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m8.5 12.5 2.5 2.5 5-5" /></svg>,
  receipt: (p: IconProps) => <svg {...base(p)}><path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21z" /><path d="M9 8h6M9 12h6M9 16h4" /></svg>,
  wallet: (p: IconProps) => <svg {...base(p)}><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M16 14.5h2" /></svg>,
  bell: (p: IconProps) => <svg {...base(p)}><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>,
  qr: (p: IconProps) => <svg {...base(p)}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14v2M17 20h3M20 18v3" /></svg>,
  scan: (p: IconProps) => <svg {...base(p)}><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><path d="M4 12h16" /></svg>,
  settings: (p: IconProps) => <svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></svg>,
  logout: (p: IconProps) => <svg {...base(p)}><path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5M15 8l4 4-4 4M19 12H9" /></svg>,
  plus: (p: IconProps) => <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>,
  arrow: (p: IconProps) => <svg {...base(p)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  back: (p: IconProps) => <svg {...base(p)}><path d="M19 12H5M11 18l-6-6 6-6" /></svg>,
  close: (p: IconProps) => <svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>,
  menu: (p: IconProps) => <svg {...base(p)}><path d="M4 7h16M4 12h16M4 17h16" /></svg>,
  refresh: (p: IconProps) => <svg {...base(p)}><path d="M20 12a8 8 0 1 1-2.3-5.7" /><path d="M20 4v5h-5" /></svg>,
  download: (p: IconProps) => <svg {...base(p)}><path d="M12 4v11M7 10l5 5 5-5M4 19h16" /></svg>,
  upload: (p: IconProps) => <svg {...base(p)}><path d="M12 15V4M7 9l5-5 5 5M4 19h16" /></svg>,
  search: (p: IconProps) => <svg {...base(p)}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4-4" /></svg>,
  mail: (p: IconProps) => <svg {...base(p)}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>,
  key: (p: IconProps) => <svg {...base(p)}><circle cx="8" cy="14" r="4" /><path d="m11 11 9-9M16 6l2 2M13 9l2 2" /></svg>,
  shield: (p: IconProps) => <svg {...base(p)}><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" /></svg>,
  info: (p: IconProps) => <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" /></svg>,
  warning: (p: IconProps) => <svg {...base(p)}><path d="M12 3 2 20h20z" /><path d="M12 9v5M12 17h.01" /></svg>,
  clock: (p: IconProps) => <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
  edit: (p: IconProps) => <svg {...base(p)}><path d="m4 20 4-1 11-11-3-3L5 16z" /><path d="m13 7 3 3" /></svg>,
  eye: (p: IconProps) => <svg {...base(p)}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>,
  external: (p: IconProps) => <svg {...base(p)}><path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></svg>,
  trend: (p: IconProps) => <svg {...base(p)}><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></svg>,
  door: (p: IconProps) => <svg {...base(p)}><path d="M5 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17" /><path d="M3 21h18M13 12h.01" /></svg>,
};

export type IconName = keyof typeof Icon;
