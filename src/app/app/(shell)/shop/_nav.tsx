"use client";

import Link from "next/link";
import { useSession } from "../../_lib/session";

/** The merchandise sub-navigation, drawn as Azman's treasury pill tabs. */
export function ShopNav({ active }: { active: "shop" | "orders" | "desk" | "manage" }) {
  const { can } = useSession();
  const items = [
    { key: "shop", href: "/app/shop", label: "Shop" },
    { key: "orders", href: "/app/shop/orders", label: "My orders" },
    ...(can("payments:confirm") || can("orders:fulfil") ? [{ key: "desk", href: "/app/shop/desk", label: "Orders desk" }] : []),
    ...(can("products:write") ? [{ key: "manage", href: "/app/shop/manage", label: "Manage products" }] : []),
  ];
  return (
    <nav className="treasury-tabs" aria-label="Merchandise sections">
      {items.map((item) => (
        <Link key={item.key} href={item.href} className={`treasury-tab ${item.key === active ? "active" : ""}`.trim()} aria-current={item.key === active ? "page" : undefined}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
