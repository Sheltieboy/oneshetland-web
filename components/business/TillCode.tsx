"use client";

import { useEffect, useRef, useState } from "react";
import { BIZ, type BusinessCode } from "@/lib/business-data";
import { refreshBusinessCode } from "@/lib/business-client";

/**
 * TillCode — rotating at-till redemption code shown to the business owner.
 * Mirrors the app dashboard's till-code card (local-business-dashboard ~L747):
 * a 6-digit code the customer reads back at the till for wallet/loyalty redemption.
 *
 * The app derives this client-side — it mints a new code and upserts it to
 * local_business_codes on a 60s timer. We replicate that here. `initial` is the
 * server-fetched current row (may be stale); on mount we immediately refresh so
 * the displayed code is always live, then rotate every 60s.
 */
export function TillCode({ businessId, initial }: { businessId: string; initial: BusinessCode | null }) {
  const [code, setCode] = useState<string | null>(initial?.current_code ?? null);
  const [error, setError] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let alive = true;
    const rotate = async () => {
      try {
        const fresh = await refreshBusinessCode(businessId);
        if (alive) { setCode(fresh.current_code); setError(false); }
      } catch {
        if (alive) setError(true);
      }
    };
    rotate(); // refresh immediately on mount
    timer.current = setInterval(rotate, 60_000);
    return () => { alive = false; if (timer.current) clearInterval(timer.current); };
  }, [businessId]);

  return (
    <div className="rounded-card border border-line bg-paper p-5 text-center shadow-soft">
      <p className="text-xs font-bold uppercase tracking-widest text-ink-muted">Till code · show to customer</p>
      <p className="mt-2 font-mono text-4xl font-extrabold tracking-[0.3em] tabular-nums" style={{ color: BIZ }}>
        {code ?? "— — — — — —"}
      </p>
      <p className="mt-2 text-xs text-ink-faint">
        {error ? "Could not refresh — retrying…" : "Refreshes every 60 seconds"}
      </p>
    </div>
  );
}
