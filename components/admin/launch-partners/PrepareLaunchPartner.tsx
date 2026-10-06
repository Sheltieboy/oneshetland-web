"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, StatusPill } from "@/components/admin/AdminUI";
import { enrichCampaignAction, prepareCampaignAction, searchCandidatesAction } from "@/app/admin/launch-partners/actions";
import { runGuarded } from "@/lib/launch-partners/invitation-replace";
import { normaliseSourceUrl } from "@/lib/launch-partners/source-url";
import type { CandidateRow } from "@/lib/launch-partners/campaigns.server";
import { eligibilityOf, REASSURANCE, ROUTE_LABEL, ROUTE_TONE, routeNote } from "@/lib/launch-partners/eligibility";

const POSITIONINGS = ["Products + experiences", "Bookings + local discovery", "Shop + local + rewards", "Products + Shetland makers", "Products + local story"];

/** Search the existing Directory, see what each business already has, and start a launch partner from one. */
export function PrepareLaunchPartner({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<CandidateRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [positioning, setPositioning] = useState("");
  const [sources, setSources] = useState<Record<string, string>>({});
  /** Where a preparation got to, so a failure never loses the draft that was already created. */
  const [progress, setProgress] = useState<{ businessId: string; step: string; campaignId?: string; failed?: string; sourceUrl?: string } | null>(null);

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
    setBusy(c.business_id); setErr(null); setProgress(null);
    const supplied = (sources[c.business_id] ?? "").trim();
    if (c.route === "needs_source") { const u = normaliseSourceUrl(supplied); if (!u.ok) { setBusy(null); setErr(u.error); return; } }
    setProgress({ businessId: c.business_id, step: "Creating the private draft…" });
    const g = await runGuarded(() => prepareCampaignAction({ businessId: c.business_id, positioning, sourceUrl: supplied || undefined }));
    if (!g.ok) { setBusy(null); setProgress(null); setErr(g.error); return; }
    const r = g.value;
    if (!r.ok) { setBusy(null); setProgress(null); setErr(r.error); return; }
    if (!r.enrich) { setBusy(null); router.push(`/admin/launch-partners/${r.id}`); return; }
    await enrich(c.business_id, r.id, r.host ?? "the website", supplied || undefined);
  }

  /** The second step: Peerie Bot reads the website. The campaign already exists, so a failure here loses nothing and can be retried. */
  async function enrich(businessId: string, campaignId: string, host: string, sourceUrl?: string) {
    setBusy(businessId); setErr(null);
    setProgress({ businessId, campaignId, sourceUrl, step: `Peerie Bot is reading ${host} and building the draft — this can take up to half a minute…` });
    const g = await runGuarded(() => enrichCampaignAction(campaignId, { sourceUrl }), 85_000);
    setBusy(null);
    if (g.ok && g.value.ok) { setProgress(null); router.push(`/admin/launch-partners/${campaignId}`); return; }
    setProgress({ businessId, campaignId, sourceUrl, step: "", failed: g.ok ? (g.value as { error: string }).error : g.error });
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
          {rows.map((c) => { const el = eligibilityOf(c); return (
            <li key={c.business_id} className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display font-bold text-ink">{c.name}</p>
                    <StatusPill label={el.label} tone={el.tone} />
                    <StatusPill label={c.is_claimed ? "Claimed" : "Unclaimed"} tone={c.is_claimed ? "blue" : "gray"} />
                    {c.has_campaign && <StatusPill label="Already a launch partner" tone="purple" />}
                  </div>
                  <p className="mt-0.5 text-sm text-ink-muted">{[c.category, c.locality ?? c.address].filter(Boolean).join(" · ") || "—"}</p>
                  <p className="mt-1 text-sm text-ink-soft">
                    {c.owner_name ? `Owner: ${c.owner_name}` : "No owner"} · Plan: {c.plan_live ? c.tier : "Free"} ·{" "}
                    {c.product_count} product{c.product_count === 1 ? "" : "s"}, {c.service_count} service{c.service_count === 1 ? "" : "s"}, {c.offer_count} offer{c.offer_count === 1 ? "" : "s"}, {c.pass_count} pass{c.pass_count === 1 ? "" : "es"}
                  </p>
                  {el.state === "hidden_from_public" && <p className="mt-1 text-xs text-ink-muted">Visitors can’t see this listing (it’s a test fixture). You can still prepare a private preview from it.</p>}
                  {el.state === "unlisted" && <p className="mt-1 text-xs text-ink-muted">Not publicly listed — that’s fine. The preview is built privately and the listing isn’t touched.</p>}
                  {!c.has_campaign && (
                    <div className="mt-2 rounded-lg bg-cream/70 px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2"><StatusPill label={ROUTE_LABEL[c.route]} tone={ROUTE_TONE[c.route]} /></div>
                      <p className="mt-1 text-sm text-ink-soft">{routeNote(c.route, c.source_host)}</p>
                      {c.route === "needs_source" && (
                        <label className="mt-2 block text-sm font-semibold text-ink-soft">Business website
                          <input value={sources[c.business_id] ?? ""} onChange={(e) => setSources({ ...sources, [c.business_id]: e.target.value })} placeholder="e.g. avrilthomsonsmith.co.uk" inputMode="url" autoComplete="off" className="mt-1 block w-full rounded-lg border border-line-strong bg-white px-3 py-2 text-sm" />
                        </label>
                      )}
                      <p className="mt-1 text-xs font-semibold text-emerald-800">{REASSURANCE}</p>
                    </div>
                  )}
                  {progress?.businessId === c.business_id && progress.step && <p role="status" className="mt-2 text-sm font-semibold text-ink-soft">⏳ {progress.step}</p>}
                  {progress?.businessId === c.business_id && progress.failed && (
                    <div role="alert" className="mt-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2">
                      <p className="text-sm font-semibold text-rose-800">The private draft was created, but Peerie Bot couldn’t finish building it: {progress.failed}</p>
                      <p className="mt-1 text-xs text-rose-800">Nothing on the live listing changed. You can retry, or open the draft and add the content by hand.</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button onClick={() => enrich(c.business_id, progress.campaignId!, c.source_host ?? "the website", progress.sourceUrl)} disabled={busy !== null} className="rounded-pill bg-rose-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Retry</button>
                        <Link href={`/admin/launch-partners/${progress.campaignId}`} className="rounded-pill border border-line-strong bg-white px-4 py-1.5 text-sm font-semibold text-ink-soft hover:bg-sand">Open the draft →</Link>
                      </div>
                    </div>
                  )}
                </div>
                {c.has_campaign
                  ? <Link href={`/admin/launch-partners/${c.campaign_id}`} className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-sand">Open →</Link>
                  : progress?.businessId === c.business_id && progress.campaignId
                    ? null
                    : <button onClick={() => prepare(c)} disabled={busy !== null || (c.route === "needs_source" && !normaliseSourceUrl(sources[c.business_id]).ok)} className="rounded-pill bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50">{busy === c.business_id ? "Preparing…" : "Prepare launch preview"}</button>}
              </div>
            </li>
          ); })}
        </ul>
      )}
    </Card>
  );
}
