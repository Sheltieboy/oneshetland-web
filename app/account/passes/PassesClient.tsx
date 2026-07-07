"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { gbp } from "@/lib/stripe";
import { fetchMyPasses, type MyPass } from "@/lib/passes-data";

const LOCAL = "#7c3aed";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function PassCard({ pass }: { pass: MyPass }) {
  const expiresLabel = pass.expires_at ? `Expires ${fmtDate(pass.expires_at)}` : "No expiry";

  return (
    <li className="rounded-card border border-line bg-paper p-4 shadow-soft">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card text-lg" style={{ background: `${LOCAL}1a` }}>
          🎟️
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-ink">{pass.item_name ?? "Pass"}</span>
            {pass.from_gift && (
              <span className="shrink-0 rounded-pill px-2 py-0.5 text-xs font-bold" style={{ background: `${LOCAL}1a`, color: LOCAL }}>
                Gift
              </span>
            )}
          </div>
          {pass.business_name && <p className="text-sm text-ink-muted">{pass.business_name}</p>}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4 rounded-card bg-sand px-4 py-3">
        <div className="flex-1">
          <p className="font-display text-2xl font-bold text-ink">{pass.uses_remaining}</p>
          <p className="text-xs font-semibold text-ink-muted">{pass.uses_remaining === 1 ? "use left" : "uses left"}</p>
        </div>
        <div className="h-8 w-px bg-line" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-ink">{expiresLabel}</p>
          <p className="text-xs font-semibold text-ink-muted">{gbp(pass.paid_amount_pence)} paid</p>
        </div>
      </div>
    </li>
  );
}

export function PassesClient() {
  const [passes, setPasses] = useState<MyPass[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setPasses(await fetchMyPasses());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load your passes.");
        setPasses([]);
      }
    })();
  }, []);

  if (error) {
    return <p className="rounded-card border border-line bg-paper px-4 py-3 text-sm text-rose-600">{error}</p>;
  }

  if (passes === null) {
    return (
      <div className="space-y-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-card border border-line bg-sand" />
        ))}
      </div>
    );
  }

  if (passes.length === 0) {
    return (
      <div className="rounded-card border border-line bg-paper p-10 text-center shadow-soft">
        <p className="font-display font-bold text-ink">Nothing yet</p>
        <p className="mt-1 text-sm text-ink-muted">
          Day passes, class packs and vouchers you buy from Shetland businesses appear here.
        </p>
        <Link
          href="/directory"
          className="mt-5 inline-block rounded-pill px-5 py-2.5 text-sm font-semibold text-paper"
          style={{ background: LOCAL }}
        >
          Browse the directory
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {passes.map((p) => (
        <PassCard key={p.id} pass={p} />
      ))}
    </ul>
  );
}
