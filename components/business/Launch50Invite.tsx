"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

/**
 * Business Suite dashboard: a small invitation to OneShetland Launch 50. Rendered by the server ONLY when the business can actually reserve a place
 * right now (see launch50InviteVisible), so enrolled businesses, businesses on a plan and businesses outside the first-access window never see it.
 * "Not now" is remembered on this browser, per business. Nothing here reserves or charges anything: the button opens the business's billing page.
 */
export function Launch50Invite({ businessId, base, firstAccessUntil, publicOpen }: { businessId: string; base: string; firstAccessUntil: string | null; publicOpen: boolean }) {
  const key = `l50-invite-dismissed:${businessId}`;
  const dismissed = useSyncExternalStore(
    (notify) => { window.addEventListener("storage", notify); window.addEventListener("l50-invite", notify); return () => { window.removeEventListener("storage", notify); window.removeEventListener("l50-invite", notify); }; },
    () => { try { return localStorage.getItem(key) === "1"; } catch { return false; } },
    () => false,
  );
  if (dismissed) return null;
  return (
    <section aria-labelledby={`l50-${businessId}`} className="overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-paper to-paper p-5 shadow-soft" data-launch50-invite>
      <p className="text-xs font-bold uppercase tracking-widest text-violet-800">OneShetland Launch 50</p>
      <h2 id={`l50-${businessId}`} className="mt-1 font-display text-xl font-bold text-ink">A special price for 50 Shetland businesses</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <p className="rounded-xl bg-paper px-4 py-3 text-ink shadow-soft"><span className="block text-xs font-semibold uppercase tracking-wide text-ink-muted">Launch Pro</span><span className="font-display text-2xl font-bold">£9</span><span className="text-sm text-ink-soft">/month</span></p>
        <p className="rounded-xl bg-paper px-4 py-3 text-ink shadow-soft"><span className="block text-xs font-semibold uppercase tracking-wide text-ink-muted">Launch Premium</span><span className="font-display text-2xl font-bold">£22</span><span className="text-sm text-ink-soft">/month</span></p>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">
        Both for 12 months, then the normal £12 and £29 a month. Monthly billing only, and you can cancel any time.
        {!publicOpen && firstAccessUntil ? <> First access for businesses already on OneShetland runs until <strong className="text-ink">{firstAccessUntil}</strong>.</> : null}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link href={`${base}/billing#launch-50`} className="inline-flex min-h-[44px] items-center rounded-pill bg-navy px-5 py-2.5 text-sm font-bold text-paper shadow-soft hover:brightness-110">See the Launch 50 plans</Link>
        <Link href="/launch-50" className="inline-flex min-h-[44px] items-center text-sm font-semibold text-ink-soft underline underline-offset-4 hover:text-ink">See the showcase</Link>
        <button type="button" className="min-h-[44px] px-2 text-sm font-semibold text-ink-soft underline"
          onClick={() => { try { localStorage.setItem(key, "1"); } catch { /* ignore */ } window.dispatchEvent(new Event("l50-invite")); }}>Not now</button>
      </div>
    </section>
  );
}
