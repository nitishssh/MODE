"use client";

import Link from "next/link";
import { LanguageSwitcher } from "@/i18n/client";
import { Icon } from "../_components/icons";
import { useT } from "../_lib/i18n";
import { AuthLanyard } from "./_lanyard";

/**
 * Left half of the sign-in and registration screens: the product's brand,
 * tagline and a paper "sheet" listing what the workspace runs, so the page
 * reads as the first screen of MODE rather than a detached form.
 */
/** `cardName` mirrors the form's name or student-id field onto the lanyard card as the visitor types. */
export function AuthStory({ cardName = "" }: { cardName?: string }) {
  const { t } = useT();
  return (
    <aside className="mx-login-story" aria-hidden="true">
      <Link className="brand" href="/" aria-label={t("shell.brandHome")}>
        <span className="brand-mark"><span /><span /><span /></span>
        MODE<span className="brand-dot">.</span>
      </Link>
      <div>
        <p className="mx-login-kicker">{t("shell.studentOrganization")}</p>
        <h1>{t("shell.title")} <span>{t("overview.lede")}</span></h1>
        <p>{t("shell.description")}</p>
      </div>
      <AuthLanyard name={cardName} />
      <div className="mx-login-sheet mx-login-sheet-compact">
        <ul>
          <li><i><Icon name="people" size={16} /></i><strong>{t("nav.members")}</strong><small>{t("membership.label")}</small></li>
          <li><i><Icon name="calendar" size={16} /></i><strong>{t("nav.events")}</strong><small>{t("nav.myTickets")}</small></li>
          <li><i><Icon name="wallet" size={16} /></i><strong>{t("nav.treasury")}</strong><small>{t("nav.myExpenses")}</small></li>
        </ul>
      </div>
      <p className="mx-login-foot">{t("shell.footerBrand")}</p>
    </aside>
  );
}

export function AuthLanguage() {
  return <div className="mx-login-lang"><LanguageSwitcher /></div>;
}
