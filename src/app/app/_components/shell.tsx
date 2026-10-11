"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Dashboard, Notification } from "@/lib/contracts";
import { LanguageSwitcher } from "@/i18n/client";
import { Icon, type IconName } from "./icons";
import { api } from "../_lib/api";
import { initials } from "../_lib/format";
import { useRequireSession, type Permission } from "../_lib/session";

/*
 * Azman's workspace chrome, verbatim: .workspace > .sidebar (brand, club
 * switch, nav-caption, nav-items with counts, sidebar-note, sidebar-profile)
 * and .workspace-body > .topbar (mobile menu, breadcrumb, workspace search,
 * language switcher, theme toggle, sample-data indicator, account dropdown)
 * followed by <main> and the .workspace-footer.
 */

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  anyOf?: Permission[];
  exact?: boolean;
  count?: (d: Dashboard | null, unread: number) => number | undefined;
}

const NAV: NavItem[] = [
  { href: "/app", label: "Overview", icon: "grid", exact: true },
  { href: "/app/members", label: "Members", icon: "people", anyOf: ["members:read"], count: (d) => d?.metrics.members },
  { href: "/app/events", label: "Events", icon: "calendar" },
  { href: "/app/announcements", label: "Announcements", icon: "megaphone" },
  { href: "/app/shop", label: "Merchandise", icon: "bag" },
  { href: "/app/tasks", label: "Tasks", icon: "check", count: (d) => { const open = d?.tasks.filter((t) => t.status !== "done").length ?? 0; return open || undefined; } },
  { href: "/app/expenses", label: "My Expenses", icon: "receipt" },
  { href: "/app/treasury", label: "Treasury", icon: "wallet", anyOf: ["ledger:read"] },
  { href: "/app/tickets", label: "My tickets", icon: "ticket" },
  { href: "/app/pass", label: "My pass", icon: "coin" },
  { href: "/app/notifications", label: "Notifications", icon: "bell", count: (_d, unread) => unread || undefined },
];

const TITLES: [RegExp, string][] = [
  [/^\/app$/, "Overview"], [/^\/app\/members/, "Members"], [/^\/app\/events\/[^/]+\/door/, "Door scanner"], [/^\/app\/events/, "Events"],
  [/^\/app\/announcements/, "Announcements"], [/^\/app\/tasks/, "Tasks"], [/^\/app\/shop/, "Merchandise"], [/^\/app\/tickets/, "My tickets"],
  [/^\/app\/expenses/, "My Expenses"], [/^\/app\/treasury/, "Treasury"], [/^\/app\/pass/, "My pass"], [/^\/app\/notifications/, "Notifications"], [/^\/app\/settings/, "Settings"],
];

export function sectionTitle(pathname: string): string {
  return TITLES.find(([pattern]) => pattern.test(pathname))?.[1] ?? "Workspace";
}

const ROLE_LABEL: Record<string, string> = { admin: "Club lead", organizer: "Organizer", treasurer: "Treasurer", volunteer: "Volunteer", member: "Member" };

export function Shell({ children }: { children: ReactNode }) {
  const session = useRequireSession();
  const pathname = usePathname() ?? "/app";
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [search, setSearch] = useState("");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [unread, setUnread] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setNavOpen(false); setMenuOpen(false); setSearch(""); }, [pathname]);

  // Theme: same localStorage key and html class as the legacy workspace.
  useEffect(() => { setIsDark(window.localStorage.getItem("mode-theme") === "dark"); }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("mode-dark", isDark);
    window.localStorage.setItem("mode-theme", isDark ? "dark" : "light");
  }, [isDark]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (event: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const loadChrome = useCallback(async () => {
    try {
      const [d, n] = await Promise.all([api.get<Dashboard>("/api/dashboard"), api.get<{ notifications: Notification[] }>("/api/notifications")]);
      setDashboard(d);
      setUnread(n.notifications.filter((item) => !item.readAt).length);
    } catch { /* counts are best-effort */ }
  }, []);

  useEffect(() => {
    if (session.status !== "authenticated") return;
    void loadChrome();
    const id = window.setInterval(loadChrome, 60_000);
    return () => window.clearInterval(id);
  }, [session.status, loadChrome, pathname]);

  if (session.status !== "authenticated" || !session.user) {
    return <main className="loading-state" role="status"><span className="loader" /><span>Opening your workspace…</span></main>;
  }

  const { user, can } = session;
  const clubName = dashboard?.club.name ?? "Sample Student Club";
  const clubInitials = initials(clubName);
  const roleLabel = ROLE_LABEL[user.role] ?? user.role;
  const visible = (item: NavItem) => !item.anyOf || item.anyOf.some((permission) => can(permission));
  const isActive = (item: NavItem) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`));
  const totalTasks = dashboard?.tasks.length ?? 0;
  const completedTasks = dashboard?.tasks.filter((task) => task.status === "done").length ?? 0;
  const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const themeLabel = isDark ? "Switch to light theme" : "Switch to dark theme";

  const query = search.trim().toLowerCase();
  const results = query && dashboard ? [
    ...dashboard.tasks.filter((t) => `${t.title} ${t.assignee}`.toLowerCase().includes(query)).map((t) => ({ label: t.title, detail: t.assignee || "Unassigned", href: "/app/tasks" })),
    ...dashboard.members.filter((m) => `${m.name} ${m.email}`.toLowerCase().includes(query)).map((m) => ({ label: m.name, detail: m.email, href: `/app/members/${m.id}` })),
    ...dashboard.events.filter((e) => `${e.title} ${e.venue}`.toLowerCase().includes(query)).map((e) => ({ label: e.title, detail: e.venue, href: `/app/events/${e.id}` })),
    ...dashboard.announcements.filter((a) => `${a.title} ${a.body}`.toLowerCase().includes(query)).map((a) => ({ label: a.title, detail: "Announcement", href: `/app/announcements/${a.id}` })),
  ].slice(0, 6) : [];

  async function signOut() {
    setMenuOpen(false);
    try { await session.logout(); } catch { /* idempotent */ }
    router.replace("/app/login");
  }

  return (
    <div className="workspace">
      <a className="skip-link" href="#main-content">Skip to content</a>
      {navOpen ? <button className="nav-scrim" type="button" aria-label="Close navigation" onClick={() => setNavOpen(false)} /> : null}
      <aside className={`sidebar ${navOpen ? "mobile-open" : ""}`.trim()} aria-label="Workspace navigation">
        <Link className="brand" href="/app" aria-label="MODE home">
          <span className="brand-mark"><span /><span /><span /></span>
          MODE<span className="brand-dot">.</span>
        </Link>
        <div className="workspace-switch">
          <span className="club-monogram">{clubInitials}</span>
          <span><strong>{clubName}</strong><small>Student organization</small></span>
        </div>
        <p className="nav-caption">YOUR WORKSPACE</p>
        <nav aria-label="Main navigation">
          {NAV.filter(visible).map((item) => {
            const active = isActive(item);
            const count = item.count?.(dashboard, unread);
            return (
              <Link key={item.href} href={item.href} className={`nav-item ${active ? "active" : ""}`.trim()} aria-current={active ? "page" : undefined} onClick={() => setNavOpen(false)}>
                <Icon name={item.icon} />
                <span>{item.label}</span>
                {count ? <span className="nav-count">{count}</span> : null}
              </Link>
            );
          })}
          {can("tickets:check_in") ? (
            <Link href="/app/events?door=1" className={`nav-item ${pathname.endsWith("/door") ? "active" : ""}`.trim()} onClick={() => setNavOpen(false)}>
              <Icon name="scan" /><span>Door scanner</span>
            </Link>
          ) : null}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="small-star">✳</span>
            <h3>Made for the<br />people who make it happen.</h3>
            <p>Members, events, money and tasks in one calm place.</p>
          </div>
          <div className="sidebar-profile">
            <span className="profile-avatar">{initials(user.name)}</span>
            <span><strong>{user.name}</strong><small>Signed in as {roleLabel}</small></span>
          </div>
        </div>
      </aside>

      <div className="workspace-body">
        <header className="topbar">
          <button className="mobile-menu" type="button" aria-label="Open navigation" onClick={() => setNavOpen(true)}><span /><span /><span /></button>
          <div className="breadcrumb">Workspace <Icon name="chevron" size={13} /><span>{sectionTitle(pathname)}</span></div>
          <div className="workspace-search-wrap">
            <label className="workspace-search">
              <Icon name="search" size={15} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search workspace" aria-label="Search workspace" />
            </label>
            {query ? (
              <div className="workspace-search-results" role="listbox">
                {results.length ? results.map((result) => (
                  <button key={`${result.href}:${result.label}`} type="button" role="option" aria-selected={false} onClick={() => { setSearch(""); router.push(result.href); }}>
                    <strong>{result.label}</strong><span>{result.detail}</span>
                  </button>
                )) : <p>No matching workspace records.</p>}
              </div>
            ) : null}
          </div>
          <div className="topbar-right">
            <LanguageSwitcher />
            <button className="theme-toggle" type="button" onClick={() => setIsDark((value) => !value)} aria-label={themeLabel} title={themeLabel}>
              <Icon name={isDark ? "sun" : "moon"} size={16} />
            </button>
            <span className="demo-indicator"><span />{dashboard?.club.demo === false ? "Live club data" : "Fictional sample data"}</span>
            <div className="topbar-user-section" ref={menuRef}>
              <div className="topbar-progress-bar" title={`Tasks completed: ${completedTasks}/${totalTasks} (${taskProgress}%)`}>
                <div className="topbar-progress-fill" style={{ width: `${taskProgress}%` }} />
              </div>
              <button type="button" className={`topbar-avatar-btn ${menuOpen ? "active" : ""}`.trim()} onClick={() => setMenuOpen((open) => !open)} aria-label="Account menu" aria-expanded={menuOpen}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                {unread ? <span className="nav-count" style={{ position: "absolute", top: -6, right: -6 }}>{unread}</span> : null}
              </button>
              {menuOpen ? (
                <div className="topbar-user-dropdown" role="menu">
                  <div className="dropdown-user-header">
                    <div className="dropdown-user-avatar">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                    </div>
                    <div className="dropdown-user-info"><strong>{user.name}</strong><span className="dropdown-role-badge">{roleLabel}</span></div>
                  </div>
                  <div className="dropdown-progress-stats">
                    <div className="dropdown-progress-label"><span>Tasks completed</span><b>{completedTasks}/{totalTasks} ({taskProgress}%)</b></div>
                    <div className="dropdown-progress-bar"><div className="dropdown-progress-fill" style={{ width: `${taskProgress}%` }} /></div>
                  </div>
                  <div className="dropdown-divider" />
                  <button type="button" className="dropdown-subscription-btn" role="menuitem" onClick={() => { setMenuOpen(false); router.push("/app/pass"); }}>
                    <span aria-hidden="true">✦</span><span>My pass</span><small>QR &amp; door code</small>
                  </button>
                  <button type="button" className="dropdown-subscription-btn" role="menuitem" onClick={() => { setMenuOpen(false); router.push("/app/settings"); }}>
                    <span aria-hidden="true">⚙</span><span>Settings</span><small>Password &amp; account</small>
                  </button>
                  <button type="button" className="dropdown-signout-btn" role="menuitem" onClick={() => void signOut()}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                    <span>Sign out</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          {children}
          <footer className="workspace-footer">
            <span><span className="footer-dot" />MODE starter workspace</span>
            <p>{dashboard?.club.demo === false ? "Local database" : "Fictional seed records · Local database"} · Reimbursements record payments made outside MODE.</p>
          </footer>
        </main>
      </div>
    </div>
  );
}
