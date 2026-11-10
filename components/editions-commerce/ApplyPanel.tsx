"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { applyToTier } from "@/app/account/editions/commerce-actions";
import { benefitText, type PublicTier } from "@/lib/editions/commerce";
import { Notice } from "@/components/editions-manage/kit";
import { useAction } from "@/components/editions-manage/use-action";

const money = (p: number) => `£${(p / 100).toFixed(p % 100 === 0 ? 0 : 2)}`;
/** The price as a magazine would set it: one large figure, the period small beside it, the alternative (and VAT) quietly beneath. */
function TierPrice({ t }: { t: PublicTier }) {
  if (t.is_free) return <p className="ed-price" style={{ margin: 0 }}>Free</p>;
  const monthly = t.price_monthly_pence, annual = t.price_annual_pence;
  const main = monthly ?? annual ?? 0, per = monthly != null ? "a month" : "a year";
  const alt = monthly != null && annual != null ? `or ${money(annual)} a year` : null;
  const vat = t.vat_mode === "exclusive" ? "plus VAT" : t.vat_mode === "inclusive" ? "including VAT" : null;
  return (
    <p className="ed-price" style={{ margin: 0 }}>
      {money(main)}<span style={{ fontSize: "1rem", letterSpacing: 0, fontFamily: "var(--font-inter), system-ui, sans-serif", fontWeight: 500 }}> {per}</span>
      {(alt || vat) && <small>{[alt, vat].filter(Boolean).join(", ")}</small>}
    </p>
  );
}

/** The public membership page's tiers with a plain Apply or Join flow. Signed out: a sign-in link that returns here. Business owners choose which business is joining. */
export function ApplyPanel({ tiers, businesses, signedIn, nextPath }: { tiers: PublicTier[]; businesses: { id: string; name: string }[]; signedIn: boolean; nextPath: string }) {
  const router = useRouter(); const act = useAction();
  const [biz, setBiz] = useState(businesses[0]?.id ?? ""); const [interval, setInterval_] = useState<Record<string, string>>({}); const [msg, setMsg] = useState<Record<string, string>>({}); const [open, setOpen] = useState<string | null>(null);
  const feature = tiers.find((t) => t.edition_benefit === "free" && !t.is_free)?.tier_id ?? null;
  return (
    <ul className="ed-tiers" style={{ listStyle: "none", margin: 0, padding: 0, ["--cols" as string]: Math.min(tiers.length, 3) }}>{tiers.map((t) => { const iv = interval[t.tier_id] ?? (t.price_monthly_pence != null ? "monthly" : "annual"); const verb = t.join_mode === "open" ? (t.is_free ? "Join" : "Join and pay") : "Apply to join"; const isFeature = t.tier_id === feature && tiers.length > 1; return (
      <li key={t.tier_id} className={`ed-tier-card${isFeature ? " ed-tier-card--feature" : ""}`}>
        <p className="ed-eyebrow" style={{ margin: 0 }}>{isFeature ? "Most popular" : t.join_mode === "invite_only" ? "By invitation" : t.join_mode === "application" ? "By application" : "Open to join"}</p>
        <h2 className="ed-display ed-h2" style={{ margin: 0 }}>{t.name}</h2>
        <TierPrice t={t} />
        {t.description && <p style={{ margin: 0 }}>{t.description}</p>}
        {t.benefits.length > 0 && <ul className="ed-checks">{t.benefits.map((b) => <li key={b}>{b}</li>)}</ul>}
        {benefitText(t) && <p style={{ margin: 0, fontWeight: 650 }}>{benefitText(t)}</p>}
        <div style={{ marginTop: "auto", paddingTop: "1rem" }}>
          {t.full ? <p className="ed-small" style={{ margin: 0, fontWeight: 650 }}>This tier is full.</p> : !signedIn ? <Link href={`/sign-in?next=${encodeURIComponent(nextPath)}`} className={`ed-btn ${isFeature ? "ed-btn--light" : "ed-btn--solid"}`}>Sign in to {verb.toLowerCase()}</Link> : businesses.length === 0 ? <p className="ed-small" style={{ margin: 0 }}>Memberships are for businesses listed on OneShetland. <Link href="/directory" className="ed-link">Find or add your business</Link>.</p> : open === t.tier_id ? (
            <form style={{ display: "grid", gap: "0.9rem" }} onSubmit={(e) => { e.preventDefault(); act.run(() => applyToTier(t.tier_id, biz, t.is_free ? "" : iv, msg[t.tier_id]), { onOk: () => router.push("/account/editions") }); }}>
              {businesses.length > 1 && <label className="ed-field" htmlFor={`b-${t.tier_id}`}><span>Which business?</span><select id={`b-${t.tier_id}`} className="ed-input" value={biz} onChange={(e) => setBiz(e.target.value)}>{businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>}
              {!t.is_free && t.price_monthly_pence != null && t.price_annual_pence != null && <label className="ed-field" htmlFor={`i-${t.tier_id}`}><span>Billing</span><select id={`i-${t.tier_id}`} className="ed-input" value={iv} onChange={(e) => setInterval_({ ...interval, [t.tier_id]: e.target.value })}><option value="monthly">Monthly</option><option value="annual">Yearly</option></select></label>}
              {t.join_mode === "application" && <label className="ed-field" htmlFor={`m-${t.tier_id}`}><span>A few words for the organiser (optional)</span><textarea id={`m-${t.tier_id}`} className="ed-input" style={{ minHeight: "5rem" }} maxLength={500} value={msg[t.tier_id] ?? ""} onChange={(e) => setMsg({ ...msg, [t.tier_id]: e.target.value })} /></label>}
              <p className="ed-small" style={{ margin: 0 }}>Your listing, plan and offers stay exactly as you manage them. You can cancel any time.</p><Notice msg={act.msg} />
              <button type="submit" className={`ed-btn ${isFeature ? "ed-btn--light" : "ed-btn--solid"}`} disabled={act.pending}>{act.pending ? "Sending…" : verb}</button></form>
          ) : <button type="button" className={`ed-btn ${isFeature ? "ed-btn--light" : "ed-btn--solid"}`} onClick={() => setOpen(t.tier_id)}>{verb}</button>}
        </div></li>); })}</ul>
  );
}
