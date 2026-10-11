"use client";

import { useT } from "../_lib/i18n";
import { EmptyState, LinkButton } from "../_components/ui";

export default function NotFound() {
  const { t } = useT();
  return (
    <section className="panel">
      <EmptyState title={t("state.notFoundTitle")} action={<LinkButton href="/app" variant="primary">{t("state.backToOverview")}</LinkButton>}>
        {t("state.notFoundBody")}
      </EmptyState>
    </section>
  );
}
