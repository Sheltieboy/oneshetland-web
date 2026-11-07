"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { getItDoneStatus } from "@/lib/get-it-done-eligibility";

/**
 * Get it done in the Business Suite.
 *  - not joined + eligible category  -> a single, dismissible invitation ("Not now" is remembered on this browser, per business)
 *  - joined                          -> a status line and a management link instead of a repeated invitation
 *  - not joined + not eligible       -> nothing (they can still join from Grow -> Get it done: job leads)
 * It never enrols anybody: the button opens that business's own job-leads page, where the owner chooses what they cover.
 */
export function GetItDoneInvite({
  businessId, base, eligible, isTrade, availabilityLabel, availabilityFresh,
}: { businessId: string; base: string; eligible: boolean; isTrade: boolean; availabilityLabel: string | null; availabilityFresh: boolean }) {
  const key = `gid-invite-dismissed:${businessId}`;
  // Read from localStorage without an effect: server and first client render say "not dismissed", then the real value takes over.
  const dismissed = useSyncExternalStore(
    (notify) => { window.addEventListener("storage", notify); window.addEventListener("gid-invite", notify); return () => { window.removeEventListener("storage", notify); window.removeEventListener("gid-invite", notify); }; },
    () => { try { return localStorage.getItem(key) === "1"; } catch { return false; } },
    () => false,
  );

  if (isTrade) {
    return (
      <section aria-label="Get it done" className="rounded-xl border border-line bg-paper p-4 shadow-soft">
        <p className="font-display text-lg font-bold text-ink">Get it done</p>
        <p className="mt-0.5 text-sm text-ink-soft">{getItDoneStatus({ isTrade, availabilityLabel, availabilityFresh })}</p>
        <Link href={`${base}/leads`} className="mt-2 inline-block text-sm font-bold underline" style={{ color: "#2a8b5c" }}>Manage job enquiries</Link>
      </section>
    );
  }
  if (!eligible || dismissed) return null;
  return (
    <section aria-labelledby={`gid-${businessId}`} className="rounded-xl border border-line bg-sand/40 p-5">
      <h2 id={`gid-${businessId}`} className="font-display text-xl font-bold text-ink">Get more job enquiries through OneShetland</h2>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">
        Let folk across Shetland know what work you do and whether you&apos;re taking on jobs. It&apos;s free to join, and customers choose when to share their contact details. We can&apos;t promise work.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Link href={`${base}/leads`} className="inline-flex min-h-[44px] items-center rounded-pill px-5 py-2.5 text-sm font-bold text-white" style={{ background: "#2a8b5c" }}>
          Set up job enquiries
        </Link>
        <button type="button" className="min-h-[44px] px-2 text-sm font-semibold text-ink-soft underline"
          onClick={() => { try { localStorage.setItem(key, "1"); } catch { /* ignore */ } window.dispatchEvent(new Event("gid-invite")); }}>
          Not now
        </button>
      </div>
    </section>
  );
}
