"use client";

import MerchandiseShop from "@/components/merchandise-shop";
import { useSession } from "../../_lib/session";
import { PageHead } from "../../_components/ui";
import { ShopNav } from "./_nav";

/* Azman's merchandise experience, unchanged: polaroid carousel, size and
 * quantity picker, reserve button, and the order register (officer desk or
 * personal register depending on permissions). Product management lives at
 * /app/shop/manage. */

export default function ShopPage() {
  const { user, can } = useSession();
  if (!user) return null;
  return (
    <>
      <PageHead eyebrow={<>CLUB <span>/</span> MERCHANDISE</>} title="Merchandise" description="Club essentials, with orders and stock in one place." />
      {can("products:write") || can("payments:confirm") || can("orders:fulfil") ? <ShopNav active="shop" /> : null}
      <MerchandiseShop user={user} />
    </>
  );
}
