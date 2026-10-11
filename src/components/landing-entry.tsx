"use client";

import { useEffect } from "react";
import { LandingPage } from "./landing-page";
import { legacyRootTarget } from "../../shared/page-routes";

export function LandingEntry({ expoWeb }: { expoWeb: boolean }) {
  useEffect(() => {
    const migrateBookmark = () => {
      const target = legacyRootTarget(window.location.hash, expoWeb);
      if (target) window.location.replace(target);
    };
    migrateBookmark();
    window.addEventListener("hashchange", migrateBookmark);
    // Signed-in visitors at the site root use the role-aware workspace at /app; /legacy keeps the old one.
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then(response => { if (active && response.ok && !legacyRootTarget(window.location.hash, expoWeb)) window.location.replace("/app"); })
      .catch(() => undefined);
    return () => { active = false; window.removeEventListener("hashchange", migrateBookmark); };
  }, [expoWeb]);

  return <LandingPage onSignIn={() => window.location.assign("/app/login")} />;
}
