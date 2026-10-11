"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Dashboard, Notification } from "@/lib/contracts";
import { LanguageSwitcher } from "@/i18n/client";
import type { AppKey } from "@/i18n/app";
import { Icon, type IconName } from "./icons";
import { api } from "../_lib/api";
import { initials } from "../_lib/format";
import { useT } from "../_lib/i18n";
import { useRequireSession, type Permission } from "../_lib/session";
import { allowedSections, homeFor, sectionFor, type Section } from "../_lib/access";
import { EmptyState } from "./ui";

/*
 * Azman's workspace chrome, verbatim: .workspace > .sidebar (brand, club
 * switch, nav-caption, nav-items with counts, sidebar-note, sidebar-profile)
 * and .workspace-body > .topbar (mobile menu, breadcrumb, workspace search,
 * language switcher, theme toggle, sample-data indicator, account dropdown)
 * followed by <main> and the .workspace-footer.
 */

interface NavItem {
  href: string;
  section: Section;
  label: AppKey;
  icon: IconName;
  anyOf?: Permission[];
  exact?: boolean;
  count?: (d: Dashboard | null, unread: number) => number | undefined;
}

const NAV: NavItem[] = [
  { href: "/app", section: "overview", label: "nav.overview", icon: "grid", exact: true },
  { href: "/app/members", section: "members", label: "nav.members", icon: "people", anyOf: ["members:read"], count: (d) => d?.metrics.members },
  { href: "/app/events", section: "events", label: "nav.events", icon: "calendar" },
  { href: "/app/door", section: "door", label: "nav.doorScanner", icon: "scan" },
  { href: "/app/announcements", section: "announcements", label: "nav.announcements", icon: "megaphone" },
  { href: "/app/shop", section: "shop", label: "nav.merchandise", icon: "bag" },
  { href: "/app/tasks", section: "tasks", label: "nav.tasks", icon: "check", count: (d) => { const open = d?.tasks.filter((t) => t.status !== "done").length ?? 0; return open || undefined; } },
  { href: "/app/expenses", section: "expenses", label: "nav.myExpenses", icon: "receipt" },
  { href: "/app/treasury", section: "treasury", label: "nav.treasury", icon: "wallet", anyOf: ["ledger:read"] },
  { href: "/app/tickets", section: "tickets", label: "nav.myTickets", icon: "ticket" },
  { href: "/app/pass", section: "pass", label: "nav.myPass", icon: "coin" },
  { href: "/app/notifications", section: "notifications", label: "nav.notifications", icon: "bell", count: (_d, unread) => unread || undefined },
];

const TITLES: [RegExp, AppKey][] = [
  [/^\/app$/, "nav.overview"], [/^\/app\/door/, "nav.doorScanner"], [/^\/app\/members/, "nav.members"], [/^\/app\/events\/[^/]+\/door/, "nav.doorScanner"], [/^\/app\/events/, "nav.events"],
  [/^\/app\/announcements/, "nav.announcements"], [/^\/app\/tasks/, "nav.tasks"], [/^\/app\/shop/, "nav.merchandise"], [/^\/app\/tickets/, "nav.myTickets"],
  [/^\/app\/expenses/, "nav.myExpenses"], [/^\/app\/treasury/, "nav.treasury"], [/^\/app\/pass/, "nav.myPass"], [/^\/app\/notifications/, "nav.notifications"], [/^\/app\/settings/, "nav.settings"],
];

export function sectionTitleKey(pathname: string): AppKey {
  return TITLES.find(([pattern]) => pattern.test(pathname))?.[1] ?? "shell.sectionFallback";
}

export function Shell({ children }: { children: ReactNode }) {
  const session = useRequireSession();
  const { t } = useT();
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

  // Roles whose slice has no overview land on their first section instead.
  useEffect(() => {
    if (session.status === "authenticated" && session.user && pathname === "/app" && !allowedSections(session.user).has("overview")) {
      router.replace(homeFor(session.user));
    }
  }, [session.status, session.user, pathname, router]);

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
    return <main className="loading-state" role="status"><span className="loader" /><span>{t("shell.opening")}</span></main>;
  }

  const { user, can } = session;
  const clubName = dashboard?.club.name ?? t("shell.defaultClub");
  const clubInitials = initials(clubName);
  const roleLabel = user.role === "admin" ? t("role.adminLong") : t(`role.${user.role}` as AppKey);
  const allowed = allowedSections(user);
  const visible = (item: NavItem) => allowed.has(item.section) && (!item.anyOf || item.anyOf.some((permission) => can(permission)));
  const currentSection = sectionFor(pathname);
  const sectionAllowed = currentSection === null || allowed.has(currentSection);
  const isActive = (item: NavItem) => (item.exact ? pathname === item.href : item.section === currentSection);
  const totalTasks = dashboard?.tasks.length ?? 0;
  const completedTasks = dashboard?.tasks.filter((task) => task.status === "done").length ?? 0;
  const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const themeLabel = isDark ? t("topbar.lightTheme") : t("topbar.darkTheme");
  const progressVars = { done: completedTasks, total: totalTasks, percent: taskProgress };

  const query = search.trim().toLowerCase();
  const results = query && dashboard ? [
    ...dashboard.tasks.filter((task) => `${task.title} ${task.assignee}`.toLowerCase().includes(query)).map((task) => ({ label: task.title, detail: task.assignee || t("state.unassigned"), href: "/app/tasks" })),
    ...dashboard.members.filter((m) => `${m.name} ${m.email}`.toLowerCase().includes(query)).map((m) => ({ label: m.name, detail: m.email, href: `/app/members/${m.id}` })),
    ...dashboard.events.filter((e) => `${e.title} ${e.venue}`.toLowerCase().includes(query)).map((e) => ({ label: e.title, detail: e.venue, href: `/app/events/${e.id}` })),
    ...dashboard.announcements.filter((a) => `${a.title} ${a.body}`.toLowerCase().includes(query)).map((a) => ({ label: a.title, detail: t("topbar.resultAnnouncement"), href: `/app/announcements/${a.id}` })),
  ].slice(0, 6) : [];

  async function signOut() {
    setMenuOpen(false);
    try { await session.logout(); } catch { /* idempotent */ }
    router.replace("/app/login");
  }

  return (
    <div className="workspace">
      <a className="skip-link" href="#main-content">{t("shell.skipToContent")}</a>
      {navOpen ? <button className="nav-scrim" type="button" aria-label={t("shell.closeNavigation")} onClick={() => setNavOpen(false)} /> : null}
      <aside className={`sidebar ${navOpen ? "mobile-open" : ""}`.trim()} aria-label={t("shell.workspaceNavigation")}>
        <Link className="brand" href="/app" aria-label={t("shell.brandHome")}>
          <span className="brand-mark"><span /><span /><span /></span>
          MODE<span className="brand-dot">.</span>
        </Link>
        <div className="workspace-switch">
          <span className="club-monogram">{clubInitials}</span>
          <span><strong>{clubName}</strong><small>{t("shell.studentOrganization")}</small></span>
        </div>
        <p className="nav-caption">{t("shell.navCaption")}</p>
        <nav aria-label={t("shell.mainNavigation")}>
          {NAV.filter(visible).map((item) => {
            const active = isActive(item);
            const count = item.count?.(dashboard, unread);
            return (
              <Link key={item.href} href={item.href} className={`nav-item ${active ? "active" : ""}`.trim()} aria-current={active ? "page" : undefined} onClick={() => setNavOpen(false)}>
                <Icon name={item.icon} />
                <span>{t(item.label)}</span>
                {count ? <span className="nav-count">{count}</span> : null}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="small-star">✳</span>
            <h3>{t("shell.noteTitleLine1")}<br />{t("shell.noteTitleLine2")}</h3>
            <p>{t("shell.noteBody")}</p>
          </div>
          <div className="sidebar-profile">
            <span className="profile-avatar">{initials(user.name)}</span>
            <span><strong>{user.name}</strong><small>{t("shell.signedInAs", { role: roleLabel })}</small></span>
          </div>
        </div>
      </aside>

      <div className="workspace-body">
        <header className="topbar">
          <button className="mobile-menu" type="button" aria-label={t("shell.openNavigation")} onClick={() => setNavOpen(true)}><span /><span /><span /></button>
          <div className="breadcrumb">{t("shell.workspace")} <Icon name="chevron" size={13} /><span>{t(sectionTitleKey(pathname))}</span></div>
          {allowed.has("overview") ? <div className="workspace-search-wrap">
            <label className="workspace-search">
              <Icon name="search" size={15} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("topbar.searchPlaceholder")} aria-label={t("topbar.searchLabel")} />
            </label>
            {query ? (
              <div className="workspace-search-results" role="listbox">
                {results.length ? results.map((result) => (
                  <button key={`${result.href}:${result.label}`} type="button" role="option" aria-selected={false} onClick={() => { setSearch(""); router.push(result.href); }}>
                    <strong>{result.label}</strong><span>{result.detail}</span>
                  </button>
                )) : <p>{t("topbar.noResults")}</p>}
              </div>
            ) : null}
          </div> : <div className="workspace-search-wrap" aria-hidden="true" />}
          <div className="topbar-right">
            <LanguageSwitcher />
            <button className="theme-toggle" type="button" onClick={() => setIsDark((value) => !value)} aria-label={themeLabel} title={themeLabel}>
              <Icon name={isDark ? "sun" : "moon"} size={16} />
            </button>
            <span className="demo-indicator"><span />{dashboard?.club.demo === false ? t("topbar.liveData") : t("topbar.demoData")}</span>
            <div className="topbar-user-section" ref={menuRef}>
              <div className="topbar-progress-bar" title={t("topbar.tasksCompletedTitle", progressVars)}>
                <div className="topbar-progress-fill" style={{ width: `${taskProgress}%` }} />
              </div>
              <button type="button" className={`topbar-avatar-btn ${menuOpen ? "active" : ""}`.trim()} onClick={() => setMenuOpen((open) => !open)} aria-label={t("topbar.accountMenu")} aria-expanded={menuOpen}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                {unread ? <span className="nav-count" style={{ position: "absolute", top: -6, right: -6 }} aria-label={t("topbar.unreadNotifications", { count: unread })}>{unread}</span> : null}
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
                    <div className="dropdown-progress-label"><span>{t("topbar.tasksCompleted")}</span><b>{t("topbar.tasksProgress", progressVars)}</b></div>
                    <div className="dropdown-progress-bar"><div className="dropdown-progress-fill" style={{ width: `${taskProgress}%` }} /></div>
                  </div>
                  <div className="dropdown-divider" />
                  <button type="button" className="dropdown-subscription-btn" role="menuitem" onClick={() => { setMenuOpen(false); router.push("/app/pass"); }}>
                    <span aria-hidden="true">✦</span><span>{t("topbar.menuPass")}</span><small>{t("topbar.menuPassHint")}</small>
                  </button>
                  <button type="button" className="dropdown-subscription-btn" role="menuitem" onClick={() => { setMenuOpen(false); router.push("/app/settings"); }}>
                    <span aria-hidden="true">⚙</span><span>{t("topbar.menuSettings")}</span><small>{t("topbar.menuSettingsHint")}</small>
                  </button>
                  <button type="button" className="dropdown-signout-btn" role="menuitem" onClick={() => void signOut()}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                    <span>{t("action.signOut")}</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          {sectionAllowed ? children : <section className="panel"><EmptyState title={t("state.officerOnlyTitle")} icon="shield">{t("state.officerOnlyBody")}</EmptyState></section>}
          <footer className="workspace-footer">
            <span><span className="footer-dot" />{t("shell.footerBrand")}</span>
            <p>{dashboard?.club.demo === false ? t("shell.footerLive") : t("shell.footerDemo")} · {t("shell.footerNote")}</p>
          </footer>
        </main>
      </div>
    </div>
  );
}
