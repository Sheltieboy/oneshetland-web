"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusPill } from "@/components/admin/AdminUI";
import { enrichCampaignAction } from "@/app/admin/launch-partners/actions";
import { runGuarded } from "@/lib/launch-partners/invitation-replace";
import { normaliseSourceUrl } from "@/lib/launch-partners/source-url";
import { REASSURANCE } from "@/lib/launch-partners/eligibility";
import { Section, inputCls } from "./fields";
import type { EnrichmentRun } from "@/lib/launch-partners/campaigns.server";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Peerie Bot's private draft: what it was built from, what it left out, what to check — and the only way to rebuild it.
 * Rebuilding never happens by itself, never on a page load, and never over a draft you have edited without asking first
 * (the server demands the same confirmation, whatever this screen does).
 */
export function EnrichmentSection({ id, businessName, defaultUrl, runs, editedSince, hasContent, sent }: {
  id: string; businessName: string; defaultUrl: string; runs: EnrichmentRun[]; editedSince: boolean; hasContent: boolean; sent: boolean;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(defaultUrl);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const latest = runs[0] ?? null;
  const applied = runs.find((r) => r.status === "applied") ?? null;
  const needsConfirm = applied ? editedSince : hasContent;
  const parsed = normaliseSourceUrl(url);
  const proposal = (applied?.proposal ?? {}) as { products?: unknown[]; groups?: unknown[]; check?: string[] };

  function start() {
    setErr(null); setOk(null);
    if (!parsed.ok) { setErr(parsed.error); return; }
    if (needsConfirm) { setConfirming(true); return; }
    void run(false);
  }
  async function run(overwrite: boolean) {
    setConfirming(false); setBusy(true); setErr(null); setOk(null);
    const g = await runGuarded(() => enrichCampaignAction(id, { sourceUrl: url.trim() || undefined, overwrite }), 85_000);
    setBusy(false);
    if (!g.ok) { setErr(g.error); router.refresh(); return; }
    const r = g.value;
    if (!r.ok) { if (r.code === "would_overwrite") { setConfirming(true); return; } setErr(r.error); router.refresh(); return; }
    const c = r.result.counts;
    setOk(`Built from ${r.result.host}: ${c.pages} page${c.pages === 1 ? "" : "s"} read, ${c.pictures} picture${c.pictures === 1 ? "" : "s"}, ${c.products} example item${c.products === 1 ? "" : "s"}, ${c.groups} offer group${c.groups === 1 ? "" : "s"}. Review it below before you invite anyone.`);
    router.refresh();
  }

  const label = busy ? "Peerie Bot is working…" : applied ? "Regenerate from website" : latest?.status === "failed" ? "Retry" : "Build draft from website";
  return (
    <Section id="peerie" title="Peerie Bot draft" sub="Builds this private draft from the business's own website, so you start from most of a page instead of a blank one. It is a proposal: you review and edit everything.">
      <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">{REASSURANCE} Pictures are linked from the business&rsquo;s own site for this private preview only — nothing is copied or published, and nothing becomes a real product, service or offer.</p>

      {sent && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">The invitation for {businessName} has been emailed, so the draft is no longer rebuilt automatically — the recipient may be looking at it.</p>}

      {applied && (
        <div className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill label="Built by Peerie Bot" tone="blue" />
            <span className="text-ink-muted">Run {applied.run_no} · {when(applied.created_at)} · {applied.source_url?.replace(/^https:\/\//, "")}</span>
            {editedSince && <StatusPill label="Edited since" tone="amber" />}
          </div>
          <p className="text-ink-soft">
            {applied.pages.filter((p) => p.status === "ok").length} page(s) read · {applied.images.length} picture(s) confirmed · {proposal.products?.length ?? 0} example item(s) · {proposal.groups?.length ?? 0} offer group(s) · {applied.dropped.length} claim(s) left out for lack of evidence
          </p>
          {applied.flags.length > 0 && <ul className="list-disc space-y-0.5 pl-5 text-amber-900">{applied.flags.map((f, i) => <li key={i}>{f}</li>)}</ul>}
          {(proposal.check ?? []).length > 0 && (
            <div><p className="font-bold text-ink">Please check</p><ul className="list-disc space-y-0.5 pl-5 text-ink-soft">{(proposal.check ?? []).map((f, i) => <li key={i}>{f}</li>)}</ul></div>
          )}
          <details className="rounded-lg border border-line px-3 py-2">
            <summary className="cursor-pointer font-semibold text-ink-soft">Where this came from</summary>
            <ul className="mt-2 space-y-1 text-xs text-ink-muted">
              {applied.pages.map((p, i) => <li key={i}><span className="font-semibold">{p.status === "ok" ? "Read" : p.status === "skipped" ? "Skipped" : "Couldn’t read"}</span> · {p.url}{p.detail ? ` — ${p.detail}` : ""}</li>)}
            </ul>
            {applied.images.length > 0 && <><p className="mt-2 text-xs font-semibold text-ink-soft">Pictures confirmed as real images (linked, not copied)</p><ul className="mt-1 space-y-1 text-xs text-ink-muted">{applied.images.map((p, i) => <li key={i}>{p.url}</li>)}</ul></>}
            {applied.dropped.length > 0 && <><p className="mt-2 text-xs font-semibold text-ink-soft">Left out, and why</p><ul className="mt-1 space-y-1 text-xs text-ink-muted">{applied.dropped.map((d, i) => <li key={i}>{d.item} — {d.why}</li>)}</ul></>}
          </details>
        </div>
      )}

      {latest?.status === "failed" && (
        <p role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          The last attempt ({when(latest.created_at)}) didn&rsquo;t finish: {latest.error_detail ?? "an unexpected error"} Nothing was changed. You can retry below.
        </p>
      )}

      {!sent && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[16rem] flex-1 text-sm font-semibold text-ink-soft">Business website
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="e.g. avrilthomsonsmith.co.uk" inputMode="url" autoComplete="off" className={inputCls + " w-full"} />
          </label>
          <button onClick={start} disabled={busy || confirming || !url.trim()} className="rounded-pill bg-rose-600 px-5 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-40">{label}</button>
        </div>
      )}
      {busy && <p role="status" className="text-sm font-semibold text-ink-soft">⏳ Peerie Bot is reading the website and building the draft — this can take up to half a minute…</p>}

      {confirming && (
        <div role="alertdialog" aria-labelledby="regen-title" aria-describedby="regen-body" className="rounded-xl border-2 border-rose-300 bg-rose-50 p-4">
          <p id="regen-title" className="text-sm font-bold text-rose-900">{applied && editedSince ? "You’ve edited this draft since Peerie Bot built it" : "This draft already holds content"}</p>
          <p id="regen-body" className="mt-1 text-sm text-rose-900">Rebuilding replaces the description, category, tags, picture, example items, story, offer groups, sources and review notes that Peerie Bot owns — including any changes you made to them. Your outreach opening, email, claim setting, introduction line and anything else you added by hand are kept. Nothing on the live listing changes.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button autoFocus onClick={() => setConfirming(false)} className="rounded-pill border border-line-strong bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-sand">Cancel — keep my draft</button>
            <button onClick={() => void run(true)} className="rounded-pill bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-95">Replace my edits and rebuild</button>
          </div>
        </div>
      )}
      {err && <p role="alert" className="text-sm font-semibold text-rose-700">{err}</p>}
      {ok && <p role="status" className="text-sm font-semibold text-emerald-800">{ok}</p>}
    </Section>
  );
}
