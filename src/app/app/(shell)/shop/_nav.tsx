"use client";

import Link from "next/link";
import { useSession } from "../../_lib/session";
import { useT } from "../../_lib/i18n";

/** The merchandise sub-navigation, drawn as Azman's treasury pill tabs. */
export function ShopNav({ active }: { active: "shop" | "orders" | "desk" | "manage" }) {
  const { can } = useSession();
  const { t } = useT();
  const items = [
    { key: "shop", href: "/app/shop", label: t("shop.nav.shop") },
    { key: "orders", href: "/app/shop/orders", label: t("shop.nav.orders") },
    ...(can("payments:confirm") || can("orders:fulfil") ? [{ key: "desk", href: "/app/shop/desk", label: t("shop.nav.desk") }] : []),
    ...(can("products:write") ? [{ key: "manage", href: "/app/shop/manage", label: t("shop.nav.manage") }] : []),
  ];
  return (
    <nav className="treasury-tabs" aria-label={t("shop.nav.ariaLabel")}>
      {items.map((item) => (
        <Link key={item.key} href={item.href} className={`treasury-tab ${item.key === active ? "active" : ""}`.trim()} aria-current={item.key === active ? "page" : undefined}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
