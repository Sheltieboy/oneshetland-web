"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { gbp } from "@/lib/currency";
import { fetchMyPasses, type MyPass } from "@/lib/passes-data";
import { RedeemDialog } from "@/components/local/RedeemDialog";

const LOCAL = "#7c3aed";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_PILL: Record<MyPass["status"], { label: string; tone: string }> = {
  active:  { label: "Active",   tone: "bg-emerald-50 text-emerald-700" },
  used:    { label: "Used up",  tone: "bg-slate-100 text-slate-600" },
  expired: { label: "Expired",  tone: "bg-amber-50 text-amber-700" },
};

function PassCard({ pass }: { pass: MyPass }) {
  const expiresLabel = pass.expires_at ? `Expires ${fmtDate(pass.expires_at)}` : "No expiry";
  const daysToExpiry = pass.expires_at
    ? Math.ceil((new Date(pass.expires_at).getTime() - Date.now()) / 86_400_000)
    : null;
  const expiringSoon = pass.status === "active" && daysToExpiry !== null && daysToExpiry >= 0 && daysToExpiry <= 7;
  const [redeeming, setRedeeming] = useState(false);
  const [usesLeft, setUsesLeft] = useState(pass.uses_remaining);

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
            <span className={`shrink-0 rounded-pill px-2 py-0.5 text-xs font-bold ${STATUS_PILL[pass.status].tone}`}>
              {STATUS_PILL[pass.status].label}
            </span>
          </div>
          {pass.business_name && <p className="text-sm text-ink-muted">{pass.business_name}</p>}
        </div>
        {expiringSoon && usesLeft > 0 && (
          <span className="shrink-0 rounded-pill bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
            {daysToExpiry === 0 ? "Expires today" : `${daysToExpiry}d left`}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-4 rounded-card bg-sand px-4 py-3">
        <div className="flex-1">
          {pass.status === "active" ? (
            <>
              <p className="font-display text-2xl font-bold text-ink">{usesLeft}</p>
              <p className="text-xs font-semibold text-ink-muted">{usesLeft === 1 ? "use left" : "uses left"}</p>
            </>
          ) : (
            <>
              <p className="font-display text-lg font-bold text-ink">
                {pass.status === "used" ? "Fully used" : "Expired"}
              </p>
              <p className="text-xs font-semibold text-ink-muted">
                Bought {fmtDate(pass.created_at)}
                {pass.fully_used_at ? ` · used up ${fmtDate(pass.fully_used_at)}` : ""}
              </p>
            </>
          )}
        </div>
        <div className="h-8 w-px bg-line" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-ink">{pass.status === "active" ? expiresLabel : "\u00A0"}</p>
          <p className="text-xs font-semibold text-ink-muted">{gbp(pass.paid_amount_pence)} paid</p>
        </div>
      </div>

      {/* Only an ACTIVE pass can be spent. A used or expired one is a receipt. */}
      {pass.status === "active" && usesLeft > 0 && (
        <button
          onClick={() => setRedeeming(true)}
          className="mt-3 block w-full rounded-pill py-2.5 text-sm font-semibold text-paper transition hover:brightness-95"
          style={{ background: LOCAL }}
        >
          Use at till
        </button>
      )}
      {redeeming && (
        <RedeemDialog
          kind="pass"
          refId={pass.id}
          accent={LOCAL}
          onClose={() => setRedeeming(false)}
          /* The server's number, not oldBalance - 1. The subtraction was the
             bug: it ran more than once and showed 1 against a database that
             correctly said 2. Falls back only if the balance could not be read. */
          onDone={(remaining) => setUsesLeft((n) => (remaining ?? Math.max(0, n - 1)))}
        />
      )}
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

  const active = passes.filter((p) => p.status === "active");
  const previous = passes.filter((p) => p.status !== "active");

  // "Nothing yet" now means exactly that: never bought one. Somebody who has
  // used theirs up sees their history instead of being told it never happened.
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
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-ink-muted">Active</h2>
        {active.length > 0 ? (
          <ul className="space-y-2">{active.map((p) => <PassCard key={p.id} pass={p} />)}</ul>
        ) : (
          <p className="rounded-card border border-line bg-paper px-4 py-3 text-sm text-ink-muted">
            Nothing to use right now.
          </p>
        )}
      </section>

      {previous.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-ink-muted">Previous passes</h2>
          <ul className="space-y-2">{previous.map((p) => <PassCard key={p.id} pass={p} />)}</ul>
        </section>
      )}
    </div>
  );
}
