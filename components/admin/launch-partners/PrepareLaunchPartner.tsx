"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, StatusPill } from "@/components/admin/AdminUI";
import { prepareCampaignAction, searchCandidatesAction } from "@/app/admin/launch-partners/actions";
import type { CandidateRow } from "@/lib/launch-partners/campaigns.server";

const POSITIONINGS = ["Products + experiences", "Bookings + local discovery", "Shop + local + rewards", "Products + Shetland makers", "Products + local story"];

/** Search the existing Directory, see what each business already has, and start a launch partner from one. */
export function PrepareLaunchPartner({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<CandidateRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [positioning, setPositioning] = useState("");

  useEffect(() => {
    if (q.trim().length < 3) return;
    let live = true;
    const t = setTimeout(async () => {
      const r = await searchCandidatesAction(q.trim());
      if (!live) return;
      if (r.ok) { setRows(r.rows); setErr(null); } else { setRows(null); setErr(r.error); }
    }, 300);
    return () => { live = false; clearTimeout(t); };
  }, [q]);

  async function prepare(c: CandidateRow) {
    setBusy(c.business_id); setErr(null);
    const r = await prepareCampaignAction({ businessId: c.business_id, positioning });
    setBusy(null);
    if (!r.ok) { setErr(r.error); return; }
    router.push(`/admin/launch-partners/${r.id}`);
  }

  return (
    <Card className="p-5" >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-bold text-ink">Prepare a launch partner</p>
          <p className="mt-0.5 text-sm text-ink-muted">Choose an existing OneShetland Directory business. Nothing about the business changes, nothing is sent, and no invitation is made.</p>
        </div>
        <button onClick={onClose} className="rounded-pill px-3 py-1 text-sm font-semibold text-ink-muted hover:bg-sand" aria-label="Close">✕</button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_16rem]">
        <label className="text-sm font-semibold text-ink-soft">Business name (or paste its id)
          <input value={q} onChange={(e) => { setQ(e.target.value); if (e.target.value.trim().length < 3) { setRows(null); setErr(null); } }} placeholder="e.g. Shetland Jewellery" autoFocus className="mt-1 block w-full rounded-lg border border-line-strong bg-white px-3 py-2 text-sm" />
        </label>
        <label className="text-sm font-semibold text-ink-soft">Positioning <span className="font-normal text-ink-muted">(optional)</span>
          <input list="positionings" value={positioning} onChange={(e) => setPositioning(e.target.value)} className="mt-1 block w-full rounded-lg border border-line-strong bg-white px-3 py-2 text-sm" />
          <datalist id="positionings">{POSITIONINGS.map((p) => <option key={p} value={p} />)}</datalist>
        </label>
      </div>
      {err && <p role="alert" className="mt-3 text-sm font-semibold text-rose-700">{err}</p>}
      {q.trim().length > 0 && q.trim().length < 3 && <p className="mt-3 text-sm text-ink-muted">Type at least 3 letters.</p>}
      {rows && rows.length === 0 && <p className="mt-3 text-sm text-ink-muted">No Directory business matches “{q}”.</p>}
      {rows && rows.length > 0 && (
        <ul className="mt-4 space-y-3">
          {rows.map((c) => (
            <li key={c.business_id} className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display font-bold text-ink">{c.name}</p>
                    <StatusPill label={c.is_active ? "Publicly listed" : "Not publicly listed"} tone={c.is_active ? "green" : "gray"} />
                    <StatusPill label={c.is_claimed ? "Claimed" : "Unclaimed"} tone={c.is_claimed ? "blue" : "gray"} />
                    {c.has_campaign && <StatusPill label="Already a launch partner" tone="purple" />}
                  </div>
                  <p className="mt-0.5 text-sm text-ink-muted">{[c.category, c.locality ?? c.address].filter(Boolean).join(" · ") || "—"}</p>
                  <p className="mt-1 text-sm text-ink-soft">
                    {c.owner_name ? `Owner: ${c.owner_name}` : "No owner"} · Plan: {c.plan_live ? c.tier : "Free"} ·{" "}
                    {c.product_count} product{c.product_count === 1 ? "" : "s"}, {c.service_count} service{c.service_count === 1 ? "" : "s"}, {c.offer_count} offer{c.offer_count === 1 ? "" : "s"}, {c.pass_count} pass{c.pass_count === 1 ? "" : "es"}
                  </p>
                </div>
                {c.has_campaign
                  ? <Link href={`/admin/launch-partners/${c.campaign_id}`} className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-sand">Open →</Link>
                  : <button onClick={() => prepare(c)} disabled={busy !== null} className="rounded-pill bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50">{busy === c.business_id ? "Preparing…" : "Prepare launch preview"}</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
