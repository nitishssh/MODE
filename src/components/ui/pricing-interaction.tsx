"use client";

import NumberFlow from "@number-flow/react";
import { useState } from "react";

type PricingInteractionProps = {
  starterMonth: number;
  starterAnnual: number;
  proMonth: number;
  proAnnual: number;
  onStart?: (plan: "starter" | "pro", period: "monthly" | "yearly") => void;
};

export function PricingInteraction({
  starterMonth,
  starterAnnual,
  proMonth,
  proAnnual,
  onStart,
}: PricingInteractionProps) {
  const [active, setActive] = useState<0 | 1 | 2>(1);
  const [period, setPeriod] = useState<0 | 1>(0);
  const starter = period === 0 ? starterMonth : starterAnnual;
  const pro = period === 0 ? proMonth : proAnnual;
  const selectedPlan = active === 2 ? "pro" : "starter";

  return (
    <div className="pricing-interaction">
      <div className="pricing-period-toggle" role="group" aria-label="Billing period">
        <button type="button" className={period === 0 ? "active" : ""} onClick={() => setPeriod(0)}>Monthly</button>
        <button type="button" className={period === 1 ? "active" : ""} onClick={() => setPeriod(1)}>Yearly <span>save 25%</span></button>
      </div>
      <div className="pricing-plan-list" role="radiogroup" aria-label="Subscription plan">
        <button type="button" className={`pricing-plan ${active === 0 ? "selected" : ""}`} onClick={() => setActive(0)} role="radio" aria-checked={active === 0}>
          <span><strong>Free</strong><small>$0.00 / month</small></span><i aria-hidden="true" />
        </button>
        <button type="button" className={`pricing-plan ${active === 1 ? "selected" : ""}`} onClick={() => setActive(1)} role="radio" aria-checked={active === 1}>
          <span><strong>Starter <em>Popular</em></strong><small>$ <NumberFlow value={starter} /> / month</small></span><i aria-hidden="true" />
        </button>
        <button type="button" className={`pricing-plan ${active === 2 ? "selected" : ""}`} onClick={() => setActive(2)} role="radio" aria-checked={active === 2}>
          <span><strong>Pro</strong><small>$ <NumberFlow value={pro} /> / month</small></span><i aria-hidden="true" />
        </button>
      </div>
      <button className="pricing-start" type="button" onClick={() => onStart?.(selectedPlan, period === 0 ? "monthly" : "yearly")}>
        {active === 0 ? "Stay on Free" : `Choose ${selectedPlan === "pro" ? "Pro" : "Starter"}`}
        <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}
