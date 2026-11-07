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
    <section aria-labelledby={`l50-${businessId}`} className="overflow-hidden rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 via-paper to-paper shadow-soft" data-launch50-invite>
      <div className="p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-violet-800">OneShetland Launch 50</p>
        <h2 id={`l50-${businessId}`} className="mt-1 font-display text-2xl font-bold leading-tight text-ink sm:text-3xl">Help me build OneShetland&apos;s future.</h2>
        <p className="mt-3 text-base leading-relaxed text-ink-soft" data-launch50-lead>
          {publicOpen
            ? <>I&apos;m offering 50 Shetland businesses a special price for your first 12 months.</>
            : <>You joined OneShetland early, so I&apos;m offering you first access to Launch 50{firstAccessUntil ? <>, exclusively until <strong className="text-ink">{firstAccessUntil}</strong></> : null}.</>}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-violet-100 bg-paper px-3 py-3 shadow-soft sm:px-4 sm:py-4" data-launch50-invite-plan="pro">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Launch Pro</p>
            <p className="mt-1 font-display text-2xl font-bold text-ink sm:text-3xl">£9<span className="text-sm font-semibold text-ink-soft sm:text-base">/month</span></p>
            <p className="mt-0.5 text-sm text-ink-soft">for 12 months, then £12/month</p>
          </div>
          <div className="rounded-2xl border border-violet-100 bg-paper px-3 py-3 shadow-soft sm:px-4 sm:py-4" data-launch50-invite-plan="premium">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Launch Premium</p>
            <p className="mt-1 font-display text-2xl font-bold text-ink sm:text-3xl">£22<span className="text-sm font-semibold text-ink-soft sm:text-base">/month</span></p>
            <p className="mt-0.5 text-sm text-ink-soft">for 12 months, then £29/month</p>
          </div>
        </div>
        <p className="mt-2 text-sm text-ink-muted">Both can choose to appear in the extended showcase.</p>

        <div className="mt-5 rounded-2xl bg-sand/50 p-4" data-launch50-invite-note>
          <p className="text-sm leading-relaxed text-ink-soft">
            My aim is to make OneShetland sustainable, so I can keep improving it for Shetland. Once I&apos;m financially ready, I hope to introduce OneShetland Gives Back, with a monthly charity wheel that involves the community. I can&apos;t promise an amount or a date, but it&apos;s something I care about.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">Your Free listing stays free, and there&apos;s no obligation to upgrade.</p>
          <p className="mt-2 font-display text-base font-bold text-ink">Darren</p>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href={`${base}/billing#launch-50`} className="inline-flex min-h-[44px] items-center rounded-pill bg-navy px-5 py-2.5 text-sm font-bold text-paper shadow-soft hover:brightness-110">See the Launch 50 plans</Link>
          <Link href="/launch-50" className="inline-flex min-h-[44px] items-center text-sm font-semibold text-ink-soft underline underline-offset-4 hover:text-ink">See the showcase</Link>
          <button type="button" className="min-h-[44px] px-2 text-sm font-semibold text-ink-soft underline"
            onClick={() => { try { localStorage.setItem(key, "1"); } catch { /* ignore */ } window.dispatchEvent(new Event("l50-invite")); }}>Not now</button>
        </div>
      </div>
    </section>
  );
}
