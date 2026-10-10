"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Notification } from "@/lib/contracts";
import { Icon, type IconName } from "./icons";
import { api } from "../_lib/api";
import { initials } from "../_lib/format";
import { useRequireSession, type Permission } from "../_lib/session";
import { Loading } from "./ui";

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** Shown when the viewer has any of these permissions; empty means everyone. */
  anyOf?: Permission[];
  exact?: boolean;
}

const NAV: { caption: string; items: NavItem[] }[] = [
  {
    caption: "Club",
    items: [
      { href: "/app", label: "Overview", icon: "grid", exact: true },
      { href: "/app/members", label: "Members", icon: "people", anyOf: ["members:read"] },
      { href: "/app/events", label: "Events", icon: "calendar" },
      { href: "/app/announcements", label: "Announcements", icon: "megaphone" },
      { href: "/app/tasks", label: "Tasks", icon: "checkbox" },
    ],
  },
  {
    caption: "Commerce",
    items: [
      { href: "/app/shop", label: "Shop", icon: "bag" },
      { href: "/app/tickets", label: "My tickets", icon: "ticket" },
    ],
  },
  {
    caption: "Money",
    items: [
      { href: "/app/expenses", label: "Expenses", icon: "receipt" },
      { href: "/app/treasury", label: "Treasury", icon: "wallet", anyOf: ["ledger:read"] },
    ],
  },
  {
    caption: "You",
    items: [
      { href: "/app/pass", label: "Member pass", icon: "qr" },
      { href: "/app/notifications", label: "Notifications", icon: "bell" },
      { href: "/app/settings", label: "Settings", icon: "settings" },
    ],
  },
];

const TITLES: [RegExp, string][] = [
  [/^\/app$/, "Overview"],
  [/^\/app\/members/, "Members"],
  [/^\/app\/events\/[^/]+\/door/, "Door scanner"],
  [/^\/app\/events/, "Events"],
  [/^\/app\/announcements/, "Announcements"],
  [/^\/app\/tasks/, "Tasks"],
  [/^\/app\/shop/, "Shop"],
  [/^\/app\/tickets/, "My tickets"],
  [/^\/app\/expenses/, "Expenses"],
  [/^\/app\/treasury/, "Treasury"],
  [/^\/app\/pass/, "Member pass"],
  [/^\/app\/notifications/, "Notifications"],
  [/^\/app\/settings/, "Settings"],
];

function sectionTitle(pathname: string): string {
  return TITLES.find(([pattern]) => pattern.test(pathname))?.[1] ?? "Workspace";
}

export function Shell({ children }: { children: ReactNode }) {
  const session = useRequireSession();
  const pathname = usePathname() ?? "/app";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => { setOpen(false); }, [pathname]);

  const loadUnread = useCallback(async () => {
    try {
      const result = await api.get<{ notifications: Notification[] }>("/api/notifications");
      setUnread(result.notifications.filter((n) => !n.readAt).length);
    } catch { /* bell is best-effort */ }
  }, []);

  useEffect(() => {
    if (session.status !== "authenticated") return;
    void loadUnread();
    const id = window.setInterval(loadUnread, 60_000);
    return () => window.clearInterval(id);
  }, [session.status, loadUnread, pathname]);

  if (session.status !== "authenticated" || !session.user) {
    return <div className="mx-app"><Loading label="Opening your workspace…" /></div>;
  }

  const { user, can } = session;
  const visible = (item: NavItem) => !item.anyOf || item.anyOf.some((permission) => can(permission));
  const isActive = (item: NavItem) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`));

  async function signOut() {
    try { await session.logout(); } catch { /* cookie logout is idempotent; fall through to login */ }
    router.replace("/app/login");
  }

  return (
    <div className="mx-app">
      <div className="mx-shell">
        <aside className={`mx-sidebar ${open ? "open" : ""}`.trim()} aria-label="Workspace navigation">
          <Link href="/app" className="mx-brand"><i />MODE</Link>
          <div className="mx-club">
            <strong>Club workspace</strong>
            <small>Signed in as {user.role}</small>
          </div>
          {NAV.map((group) => {
            const items = group.items.filter(visible);
            if (!items.length) return null;
            return (
              <div key={group.caption}>
                <p className="mx-nav-caption">{group.caption}</p>
                <nav className="mx-nav">
                  {items.map((item) => {
                    const I = Icon[item.icon];
                    const active = isActive(item);
                    return (
                      <Link key={item.href} href={item.href} className={`mx-nav-item ${active ? "active" : ""}`.trim()} aria-current={active ? "page" : undefined}>
                        <I />
                        {item.label}
                        {item.href === "/app/notifications" && unread > 0 ? <span className="mx-nav-badge">{unread}</span> : null}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            );
          })}
          <div className="mx-sidebar-foot">
            <div className="mx-user">
              <span className="mx-avatar">{initials(user.name)}</span>
              <div style={{ minWidth: 0 }}>
                <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</strong>
                <small>{user.role}</small>
              </div>
            </div>
            <button type="button" className="mx-nav-item" onClick={() => void signOut()}><Icon.logout />Sign out</button>
          </div>
        </aside>

        <div className="mx-main">
          <header className="mx-topbar">
            <div className="mx-row">
              <button type="button" className="mx-iconbtn mx-menu-btn" aria-label="Open navigation" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? <Icon.close /> : <Icon.menu />}</button>
              <div className="mx-crumbs"><span>MODE</span><span>/</span><b>{sectionTitle(pathname)}</b></div>
            </div>
            <div className="mx-topbar-actions">
              {can("tickets:check_in") ? <Link href="/app/events?door=1" className="mx-btn sm"><Icon.scan />Door</Link> : null}
              <Link href="/app/pass" className="mx-iconbtn" aria-label="Member pass"><Icon.qr /></Link>
              <Link href="/app/notifications" className="mx-iconbtn" aria-label={unread ? `${unread} unread notifications` : "Notifications"}>
                <Icon.bell />{unread > 0 ? <span className="mx-dot" /> : null}
              </Link>
              <Link href="/app/settings" className="mx-avatar" aria-label="Account settings" style={{ width: 34, height: 34 }}>{initials(user.name)}</Link>
            </div>
          </header>
          <main className="mx-content">{children}</main>
        </div>
      </div>
    </div>
  );
}
