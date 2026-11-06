"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { INVITE_DEVICE_KEY, INVITE_DISMISS_KEY, cardMode, type InviteState } from "@/lib/accessibility-invite";

/**
 * A personal invitation from Darren, in the Business Suite. One action; a quiet way to say "not now". Once details are published it becomes a
 * small thank-you with an update link. It sends nothing to anyone: dismissing writes one preference to the owner's own account.
 */
export function AccessibleInviteCard({ businessId, businessName, state, dismissed, businessCount }: { businessId: string; businessName: string; state: InviteState; dismissed: boolean; businessCount: number }) {
  const [gone, setGone] = useState(dismissed);
  const [note, setNote] = useState<string | null>(null);
  // Fallback: a dismissal that could not be saved to the account still holds on this device.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { try { if (localStorage.getItem(INVITE_DEVICE_KEY)) setGone(true); } catch { /* storage unavailable: show the card */ } }, []);
  const href = `/accessible/edit/business/${businessId}`;
  const mode = cardMode(state, gone);

  async function dismiss() {
    setGone(true); setNote("Dismissed. You can still add this any time under Grow, in “Accessibility information”.");
    const when = new Date().toISOString();
    try { localStorage.setItem(INVITE_DEVICE_KEY, when); } catch { /* ignore */ }
    try { await createClient().auth.updateUser({ data: { [INVITE_DISMISS_KEY]: when } }); } catch { /* the device copy still holds */ }
  }

  if (mode === "thanks") {
    return (
      <section aria-labelledby="acc-thanks-h" className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-paper px-5 py-4">
        <p id="acc-thanks-h" className="text-sm text-ink"><strong className="font-display text-base">Thank you.</strong> <span className="text-ink-soft">{businessName} is helping people plan their visit with Accessible Shetland.</span></p>
        <Link href={href} className="inline-flex min-h-11 items-center rounded-pill border border-line-strong px-5 text-sm font-bold text-ink hover:bg-sand">Update accessibility details</Link>
      </section>
    );
  }
  if (mode === "none") return note ? <p role="status" className="mb-8 text-sm text-ink-soft">{note}</p> : null;

  return (
    <section aria-labelledby="acc-invite-h" className="relative mb-8 overflow-hidden rounded-3xl border border-amber-200 bg-gradient-to-br from-[#fff7e8] via-white to-[#eef6fb] p-5 shadow-soft sm:p-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo-mark-keyed.png" alt="" aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 max-w-none opacity-[.07]" />
      <div className="relative max-w-2xl">
        <div className="flex items-center gap-3 sm:gap-4">
          <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#032f4c] font-display text-xl font-bold text-white sm:h-14 sm:w-14 sm:text-2xl">D</span>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-widest text-ink-soft sm:text-xs">From Darren, founder of OneShetland</p>
            <h2 id="acc-invite-h" className="mt-0.5 font-display text-2xl font-bold leading-tight sm:text-3xl">A favour from me <span aria-hidden>💙</span><span className="sr-only">(blue heart)</span></h2>
          </div>
        </div>
        <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-ink sm:text-base">
          <p>Since launching OneShetland, I’ve had several folk get in touch about how difficult it can be to find clear accessibility information around Shetland.</p>
          <p>I want OneShetland to give people with accessibility needs the information they need to make their own decisions about where to go and what to enjoy across Shetland, whether they live here or are planning a visit.</p>
          <p>That’s why I’ve introduced Accessible Shetland.</p>
          <p>I’d love your help. Taking a few minutes to share information about access to your business could make a real difference to someone planning where to visit.</p>
          <p>It doesn’t matter if your business can’t offer everything. Honest information is what matters, helping people make their own decisions with confidence.</p>
          <p className="font-semibold">It’s completely free.</p>
          <p className="font-display text-lg italic">Thanks so much,<br />Darren</p>
        </div>
        {state === "draft" && <p className="mt-4 rounded-lg bg-white/80 px-3 py-2 text-sm text-ink-soft">You’ve already saved a draft for <strong className="text-ink">{businessName}</strong>. It isn’t public yet, so you can finish it whenever you like.</p>}
        {businessCount > 1 && <p className="mt-4 text-sm text-ink-soft">This is for <strong className="text-ink">{businessName}</strong>. Each of your businesses has its own details: use the tabs above to switch to another.</p>}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href={href} className="inline-flex min-h-12 items-center rounded-pill bg-ink px-6 text-base font-bold text-white shadow-soft transition hover:opacity-90">{state === "draft" ? "Continue accessibility information" : "Add accessibility information"}</Link>
          <button type="button" onClick={() => void dismiss()} className="inline-flex min-h-11 items-center rounded-pill px-4 text-sm font-semibold text-ink-soft underline-offset-2 hover:underline">Not now</button>
        </div>
      </div>
    </section>
  );
}
