"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, StatusPill } from "@/components/admin/AdminUI";
import { useConfirm, useNotify } from "@/components/ui/ConfirmProvider";
import { dbMessage, tierName, type LaunchLookupRow } from "@/lib/launch-grant";

export type ExclusionRow = { business_id: string; name: string; category: string | null; reason: string | null; excluded_at: string | null; live_tier: string };

const input = "w-full rounded-lg border border-line-strong bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-rose-300";
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "");
export const EXCLUDE_REASON_MIN = 5;

/**
 * Homepage showcase — the admin front for admin_set_homepage_exclusion.
 *
 * Keeps ONE named business out of the homepage's promotional showcase ("Discover local businesses" and "Recently joined") and nothing else: the
 * Local page and other discovery surfaces ignore it. It changes nothing else: the business keeps its plan and every benefit of it, and its Directory position. The rules (administrators only, a
 * reason, the audit log) are in the database; this only collects the inputs, asks first, and reports what the database said.
 */
export function HomepageShowcaseControl({ initial }: { initial: ExclusionRow[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const notify = useNotify();
  const [rows, setRows] = useState(initial);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LaunchLookupRow[] | null>(null);
  const [picked, setPicked] = useState<LaunchLookupRow | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function search() {
    setBusy("search");
    try {
      const { data, error } = await createClient().rpc("admin_launch_business_lookup", { p_query: query });
      if (error) throw error;
      setResults((data ?? []) as LaunchLookupRow[]);
      setPicked(null);
    } catch (e) { notify({ title: "Couldn't search", body: dbMessage(e), tone: "error" }); }
    finally { setBusy(null); }
  }

  async function set(id: string, name: string, excluded: boolean, why?: string) {
    const ok = await confirm({
      title: excluded ? "Keep this business off the homepage?" : "Allow this business on the homepage again?",
      body: excluded
        ? `${name}\n\nIt will no longer appear in "Discover local businesses" or "Recently joined" on the homepage. It still appears on the Local page, in the Directory and everywhere else, and its plan and benefits do not change.`
        : `${name}\n\nIt can appear in the homepage showcase again, if it qualifies.`,
      confirmLabel: excluded ? "Keep off homepage" : "Allow again",
      danger: excluded,
    });
    if (!ok) return;
    setBusy(id);
    try {
      const { error } = await createClient().rpc("admin_set_homepage_exclusion", { p_business_id: id, p_excluded: excluded, p_reason: why ?? null });
      if (error) throw error;
      notify({ title: excluded ? "Kept off the homepage" : "Allowed on the homepage", body: name, tone: "info" });
      if (excluded) {
        setRows((r) => [{ business_id: id, name, category: picked?.category ?? null, reason: why ?? null, excluded_at: new Date().toISOString(), live_tier: picked?.plan_live ? picked.tier : "free" }, ...r.filter((x) => x.business_id !== id)]);
        setPicked(null); setResults(null); setQuery(""); setReason("");
      } else {
        setRows((r) => r.filter((x) => x.business_id !== id));
      }
      router.refresh();
    } catch (e) { notify({ title: "Couldn't save", body: dbMessage(e), tone: "error" }); }
    finally { setBusy(null); }
  }

  return (
    <Card className="mt-6">
      <h2 className="font-display text-lg font-bold text-ink">Homepage business showcase</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Keep a specific business out of the homepage&apos;s promotional sections only. This does <strong>not</strong> change its plan, its benefits or its Directory position, and it does not affect the Local page or anywhere else.
      </p>

      <h3 className="mt-4 text-xs font-bold uppercase tracking-widest text-ink-muted">Currently kept off the homepage</h3>
      {rows.length === 0
        ? <p className="mt-1 text-sm text-ink-muted">None.</p>
        : (
          <ul className="mt-1 divide-y divide-line rounded-lg border border-line">
            {rows.map((r) => (
              <li key={r.business_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{r.name} {r.live_tier !== "free" && <StatusPill label={tierName(r.live_tier as "pro" | "premium")} tone="purple" />}</p>
                  <p className="truncate text-xs text-ink-muted">{[r.reason, r.excluded_at ? `since ${day(r.excluded_at)}` : null].filter(Boolean).join(" · ")}</p>
                </div>
                <button disabled={busy === r.business_id} onClick={() => void set(r.business_id, r.name, false)} className="shrink-0 rounded-pill border border-line-strong px-3 py-1 text-xs font-semibold text-ink-soft hover:bg-sand disabled:opacity-40">Allow again</button>
              </li>
            ))}
          </ul>
        )}

      <h3 className="mt-5 text-xs font-bold uppercase tracking-widest text-ink-muted">Keep another business off</h3>
      <form className="mt-1 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); void search(); }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Business name (3+ letters), or paste its id" className={input + " min-w-0 flex-1"} aria-label="Find a business" />
        <button type="submit" disabled={busy === "search" || query.trim().length < 3} className="rounded-pill bg-navy px-5 py-2 text-sm font-semibold text-white disabled:opacity-40">{busy === "search" ? "Searching…" : "Search"}</button>
      </form>
      {results && results.length === 0 && <p className="mt-2 text-sm text-ink-muted">No business matches that.</p>}
      {results && results.length > 0 && (
        <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
          {results.map((r) => (
            <li key={r.business_id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{r.name}</p>
                <p className="truncate text-xs text-ink-muted">{[r.category, r.address].filter(Boolean).join(" · ")}{r.is_active ? "" : " · inactive"}</p>
              </div>
              <button onClick={() => setPicked(r)} className="shrink-0 rounded-pill border border-line-strong px-3 py-1 text-xs font-semibold text-ink-soft hover:bg-sand">Select</button>
            </li>
          ))}
        </ul>
      )}
      {picked && (
        <div className="mt-3 rounded-lg border border-line bg-sand/40 p-3">
          <p className="text-sm font-semibold text-ink">{picked.name}</p>
          <label className="mt-2 block text-xs font-semibold text-ink-soft" htmlFor="hp-reason">Why? (kept for the record, never shown publicly)</label>
          <input id="hp-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={input + " mt-1"} placeholder="e.g. Founder-owned business" />
          <button disabled={busy === picked.business_id || reason.trim().length < EXCLUDE_REASON_MIN} onClick={() => void set(picked.business_id, picked.name, true, reason.trim())} className="mt-3 rounded-pill bg-navy px-5 py-2 text-sm font-semibold text-white disabled:opacity-40">Keep off the homepage</button>
        </div>
      )}
    </Card>
  );
}
