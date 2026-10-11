"use client";

import MerchandiseShop from "@/components/merchandise-shop";
import { useSession } from "../../_lib/session";
import { useT } from "../../_lib/i18n";
import { PageHead } from "../../_components/ui";
import { ShopNav } from "./_nav";

/* Azman's merchandise experience, unchanged: polaroid carousel, size and
 * quantity picker, reserve button, and the order register (officer desk or
 * personal register depending on permissions). Product management lives at
 * /app/shop/manage. */

export default function ShopPage() {
  const { user, can } = useSession();
  const { t } = useT();
  if (!user) return null;
  return (
    <>
      <PageHead eyebrow={<>{t("shop.eyebrowClub")} <span>/</span> {t("shop.eyebrow")}</>} title={t("shop.title")} description={t("shop.description")} />
      {can("products:write") || can("payments:confirm") || can("orders:fulfil") ? <ShopNav active="shop" /> : null}
      <MerchandiseShop user={user} />
    </>
  );
}
