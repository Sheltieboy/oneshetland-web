"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BIZ, type ManagedBusiness } from "@/lib/business-data";
import { setAcceptsBookings } from "@/lib/business-client";

export function BookingsManager({ business, servicesCount }: { business: ManagedBusiness; servicesCount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(v: boolean) {
    setBusy(true); setError(null);
    try { await setAcceptsBookings(business.id, v); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Could not update."); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4 rounded-card border border-line bg-paper p-5 shadow-soft">
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">Accept bookings</p>
          <p className="text-sm text-ink-muted">{business.accepts_bookings ? "Live — customers can book your services." : "Turn on to let customers book in-app."}</p>
        </div>
        <button type="button" onClick={() => toggle(!business.accepts_bookings)} disabled={busy} className="relative inline-flex h-6 w-11 items-center rounded-full transition disabled:opacity-50" style={{ background: business.accepts_bookings ? BIZ : "var(--color-line-strong)" }}>
          <span className={"inline-block h-5 w-5 transform rounded-full bg-white shadow transition " + (business.accepts_bookings ? "translate-x-5" : "translate-x-0.5")} />
        </button>
      </div>
      <div className="rounded-xl border border-line p-4">
        <p className="text-sm font-semibold text-ink">{servicesCount} service{servicesCount === 1 ? "" : "s"} set up</p>
        <p className="mt-1 text-xs text-ink-muted">Creating and scheduling services (durations, prices, availability) is available in the OneShetland app for now — it&apos;s coming to the web next. Bookings you receive will sync here.</p>
      </div>
    </div>
  );
}
