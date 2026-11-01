"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useOwner } from "@/components/business/OwnerProvider";
import { findListed, claimHref, listingHref, addHref, type ListedBusiness, type MatchKind } from "@/lib/business-match";

type Row = ListedBusiness & { kind: MatchKind };
const CAT: Record<string, string> = { food_drink: "Food & Drink", retail: "Retail", services: "Services", tourism: "Tourism", accommodation: "Accommodation", other: "Other" };

/**
 * The /business page's main call to action: type your business name, see whether it is already listed, and go straight to claiming it (free).
 * Not listed? "Add your business" carries the name across. Nothing here changes any data.
 *
 */
export function BusinessFinder({ plan = null }: { plan?: string | null }) {
  const { owned: ownedList, pending: pendingList } = useOwner();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setRows(null); setState("idle"); return; }
    const mine = ++seq.current;
    setState("loading");
    const t = setTimeout(async () => {
      try {
        const found = await findListed(createClient(), term);
        if (mine !== seq.current) return;      // a newer keystroke has superseded this answer
        setRows(found); setState("idle");
      } catch {
        if (mine !== seq.current) return;
        setRows(null); setState("error");
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const owned = new Set(ownedList.map((b) => b.id)), pending = new Set(pendingList.map((b) => b.id));

  return (
    <div className="rounded-2xl bg-paper p-5 text-ink shadow-lift sm:p-6" data-testid="business-finder">
      <label htmlFor="business-finder-input" className="block font-display text-xl font-bold">Find your business</label>
      <p className="mt-1 text-sm text-ink-soft">Claiming a listing is <strong>free</strong>. Start typing its name.</p>
      <input
        id="business-finder-input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="e.g. Lerwick Bakehouse"
        autoComplete="off"
        className="auth-input mt-3 w-full"
        aria-describedby="business-finder-hint"
      />
      <div id="business-finder-hint" className="mt-3 min-h-[1.5rem]" aria-live="polite">
        {state === "loading" && <p className="text-sm text-ink-muted">Searching…</p>}
        {state === "error" && (
          <p className="text-sm text-rose-700">We couldn&apos;t search just now. <Link href="/directory" className="font-semibold underline">Browse the Directory</Link> instead.</p>
        )}
        {rows && rows.length > 0 && (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {rows.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{b.name}</p>
                  <p className="truncate text-xs text-ink-muted">{[b.category ? CAT[b.category] ?? b.category : null, b.address].filter(Boolean).join(" · ")}</p>
                </div>
                {owned.has(b.id) ? (
                  <Link href={`/business/${b.id}/manage`} className="shrink-0 rounded-pill bg-navy px-4 py-2 text-sm font-bold text-paper">Open dashboard</Link>
                ) : pending.has(b.id) ? (
                  <span className="shrink-0 rounded-pill bg-sand px-3 py-1.5 text-xs font-semibold text-ink-soft">Claim under review</span>
                ) : b.is_claimed ? (
                  <Link href={listingHref(b)} className="shrink-0 text-sm font-semibold text-ink-soft underline">Already claimed</Link>
                ) : (
                  <Link href={claimHref(b)} className="shrink-0 rounded-pill bg-[#7c3aed] px-4 py-2 text-sm font-bold text-paper hover:brightness-110">Claim it free</Link>
                )}
              </li>
            ))}
          </ul>
        )}
        {rows && rows.length === 0 && state === "idle" && <p className="text-sm text-ink-soft">No listing with that name yet.</p>}
      </div>
      {(rows || q.trim().length >= 2) && (
        <Link href={addHref(q, plan)} className="mt-2 inline-block text-sm font-bold text-[#4f46e5] underline-offset-4 hover:underline">
          {rows && rows.length > 0 ? "None of these? Add your business →" : "Not listed? Add your business →"}
        </Link>
      )}
      {!q.trim() && (
        <p className="mt-1 text-sm text-ink-muted">
          Or <Link href="/directory" className="font-semibold underline">browse the Directory</Link> · <Link href="/directory/new" className="font-semibold underline">add a business that isn&apos;t listed</Link>
        </p>
      )}
    </div>
  );
}
