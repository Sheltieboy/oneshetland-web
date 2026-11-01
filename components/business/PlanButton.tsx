"use client";

import { useState } from "react";
import Link from "next/link";
import { planCta, type Tier } from "@/lib/plan-cta";
import { useOwner } from "@/components/business/OwnerProvider";

/** The button under a plan card. Renders whatever plan-cta.ts decided for this visitor; chooses between several owned businesses with a plain <select>. */
export function PlanButton({ plan, featured, accent }: { plan: Tier; featured: boolean; accent: string }) {
  const { owned } = useOwner();
  const cta = planCta(plan, owned);
  const [pick, setPick] = useState("");
  const cls = `mt-6 block rounded-pill px-5 py-3 text-center text-base font-bold transition ${featured ? "text-paper hover:brightness-110" : "border text-ink hover:bg-sand"}`;
  const style = featured ? { background: accent } : { borderColor: "var(--color-line-strong)" };

  if (cta.kind === "choose") {
    const chosen = cta.options.find((o) => o.business.id === pick) ?? cta.options[0];
    return (
      <div className="mt-6">
        <label className="block text-xs font-semibold uppercase tracking-wide text-ink-muted" htmlFor={`pick-${plan}`}>{cta.label}</label>
        <select id={`pick-${plan}`} value={chosen.business.id} onChange={(e) => setPick(e.target.value)} className="auth-input mt-1.5 w-full">
          {cta.options.map((o) => <option key={o.business.id} value={o.business.id}>{o.business.name}{o.current ? " (already on this plan)" : ""}</option>)}
        </select>
        <Link href={chosen.href} className={cls.replace("mt-6 ", "mt-3 ")} style={style}>{chosen.current ? "Manage plan" : "Continue"}</Link>
        <p className="mt-2 text-center text-xs text-ink-muted">{cta.note}</p>
      </div>
    );
  }
  return (
    <>
      <Link href={cta.href} className={cls} style={style}>{cta.label}</Link>
      <p className="mt-2 text-center text-xs text-ink-muted">{cta.note}</p>
    </>
  );
}
