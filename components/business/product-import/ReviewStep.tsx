"use client";

import { useMemo, useState } from "react";
import type { Plan, PlanItem } from "@/lib/product-import/plan";
import { buildReport } from "@/lib/product-import/report";
import { ACTION_BADGE, ACCENT, Badge, FIELD_NICE, download, rowsLabel, showValue } from "./shared";

type Filter = "all" | PlanItem["action"] | "warnings";

export function summarySentence(c: Plan["counts"]): string {
  const bits = [`${c.create} new`, `${c.update} update${c.update === 1 ? "" : "s"}`, `${c.unchanged} unchanged`];
  if (c.skip) bits.push(`${c.skip} not imported`);
  bits.push(`${c.error} need${c.error === 1 ? "s" : ""} attention`);
  return `${c.found} product${c.found === 1 ? "" : "s"} found — ${bits.join(" · ")}`;
}

export function ReviewStep({ plan, allowDup, onAllowDup, busy, onConfirm, onBack }: {
  plan: Plan;
  allowDup: boolean;
  onAllowDup: (v: boolean) => void;
  busy: boolean;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const c = plan.counts;
  const shown = useMemo(() => plan.items.filter((i) => filter === "all" || (filter === "warnings" ? i.warnings.length > 0 : i.action === filter)), [plan, filter]);
  const importable = c.create + c.update;
  const hasTitleSkips = plan.items.some((i) => i.matchedBy === "title");

  const chips: { id: Filter; label: string; n: number }[] = [
    { id: "all", label: "All", n: c.found }, { id: "create", label: "New", n: c.create }, { id: "update", label: "Updates", n: c.update },
    { id: "unchanged", label: "Unchanged", n: c.unchanged }, { id: "skip", label: "Not imported", n: c.skip },
    { id: "error", label: "Needs attention", n: c.error }, { id: "warnings", label: "Warnings", n: c.warnings },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-card border border-line bg-white p-5 shadow-soft">
        <p className="font-display text-xl font-bold text-navy" role="status">{summarySentence(c)}</p>
        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {([["New", c.create, "text-emerald-700"], ["Updates", c.update, "text-sky-700"], ["Unchanged", c.unchanged, "text-ink-soft"], ["Not imported", c.skip, "text-amber-700"], ["Need attention", c.error, "text-rose-700"]] as const).map(([k, n, cls]) => (
            <div key={k} className="rounded-xl bg-cream/60 px-3 py-2">
              <dt className="text-xs font-bold text-ink-muted">{k}</dt>
              <dd className={`font-display text-2xl font-bold ${cls}`}>{n}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm text-ink-soft">
          Nothing has been written yet. Confirming adds <strong>{c.create} new</strong> product{c.create === 1 ? "" : "s"} <strong>as drafts</strong>
          {c.update ? <> and updates <strong>{c.update}</strong> you already have</> : null}. Nothing goes live until you publish it, and you can undo the import for 7 days.
        </p>
        {c.error > 0 && <p className="mt-2 text-sm font-semibold text-rose-700">Products that need attention are left out. Fix them in your file and import again — the products that are fine won&rsquo;t be duplicated.</p>}
      </div>

      {hasTitleSkips && (
        <label className="flex items-start gap-2 rounded-card border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <input type="checkbox" className="mt-0.5" checked={allowDup} onChange={(e) => onAllowDup(e.target.checked)} />
          <span><strong>Some products have the same title as ones you already have.</strong> We never merge on a title alone, so they are not imported. Tick this to import them as new products anyway. To update the existing ones instead, add a ref or SKU to your file.</span>
        </label>
      )}

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter products">
        {chips.map((ch) => (
          <button key={ch.id} role="tab" aria-selected={filter === ch.id} onClick={() => setFilter(ch.id)}
            className={"rounded-pill px-3 py-1 text-xs font-bold transition " + (filter === ch.id ? "text-white" : "border border-line bg-white text-ink-soft hover:bg-sand")}
            style={filter === ch.id ? { background: ACCENT } : undefined}>
            {ch.label} <span className="opacity-70">{ch.n}</span>
          </button>
        ))}
        {(c.error > 0 || c.skip > 0 || c.warnings > 0) && (
          <button onClick={() => download("oneshetland-import-problems.csv", buildReport(plan.items.map((i) => ({ rows: i.rows, title: i.title, ref: i.ref, sku: i.sku, action: i.action, errors: i.errors, warnings: i.warnings }))))}
            className="ml-auto rounded-pill border border-line bg-white px-3 py-1 text-xs font-bold text-ink-soft hover:bg-sand">
            ⤓ Download the problem rows (CSV)
          </button>
        )}
      </div>

      <ul className="space-y-2" aria-label="Products in your file">
        {shown.length === 0 && <li className="rounded-card border border-dashed border-line p-6 text-center text-sm text-ink-muted">Nothing in this group.</li>}
        {shown.map((it) => <PlanRow key={it.index} it={it} />)}
      </ul>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-white/95 p-3 shadow-soft backdrop-blur">
        <button onClick={onBack} disabled={busy} className="rounded-pill px-4 py-2 text-sm font-bold text-ink-muted hover:bg-sand disabled:opacity-50">← Change file or columns</button>
        <button onClick={onConfirm} disabled={busy || importable === 0}
          className="rounded-pill px-5 py-2.5 text-sm font-bold text-white shadow-soft disabled:opacity-50" style={{ background: ACCENT }}>
          {busy ? "Starting…" : importable === 0 ? "Nothing to import" : `Import ${importable} product${importable === 1 ? "" : "s"} as drafts`}
        </button>
      </div>
    </div>
  );
}

function PlanRow({ it }: { it: PlanItem }) {
  const [open, setOpen] = useState(false);
  const b = ACTION_BADGE[it.action];
  const hasDetail = it.changes.length || it.variants.length || it.lockedSkipped.length || it.variantChanges.length;
  return (
    <li className="rounded-card border border-line bg-white p-3 shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={b.tone}>{b.label}</Badge>
        <p className="min-w-0 flex-1 break-words font-semibold text-ink">{it.title || <em className="text-ink-muted">(no title)</em>}</p>
        <span className="text-xs text-ink-muted">{rowsLabel(it.rows)}</span>
      </div>
      <p className="mt-0.5 text-xs text-ink-muted">
        {[it.ref && `ref ${it.ref}`, it.sku && `SKU ${it.sku}`, it.matchedBy && it.action !== "create" && it.action !== "error" ? `matched by ${it.matchedBy}` : null, it.variants.length ? `${it.variants.length} option${it.variants.length === 1 ? "" : "s"}` : null,
          it.action === "create" || it.action === "update" ? (it.publish === "needs_photo" ? "no photo yet" : it.publish === "needs_review" ? "policy check before publishing" : null) : null,
          it.willFetchImages ? `${it.imageUrls.length} photo${it.imageUrls.length === 1 ? "" : "s"} to copy` : null].filter(Boolean).join(" · ")}
      </p>
      {it.errors.map((e, i) => <p key={`e${i}`} className="mt-1.5 text-sm font-semibold text-rose-700">⚠ {e.message}</p>)}
      {it.warnings.map((w, i) => <p key={`w${i}`} className="mt-1.5 text-sm text-amber-800">• {w.message}</p>)}
      {hasDetail ? (
        <>
          <button onClick={() => setOpen((o) => !o)} className="mt-1.5 text-xs font-bold text-ink-soft underline underline-offset-2" aria-expanded={open}>{open ? "Hide details" : "Show details"}</button>
          {open && (
            <div className="mt-2 space-y-1 rounded-xl bg-cream/50 p-3 text-sm text-ink-soft">
              {it.changes.map((ch) => <p key={ch.field}><strong>{FIELD_NICE[ch.field] ?? ch.field}:</strong> {showValue(ch.field, ch.from)} → {showValue(ch.field, ch.to)}</p>)}
              {it.lockedSkipped.length > 0 && <p className="text-amber-800">Kept as you edited them (not overwritten): {it.lockedSkipped.map((f) => FIELD_NICE[f] ?? f).join(", ")}.</p>}
              {it.variantChanges.map((v) => <p key={v.name}><strong>Option “{v.name}”:</strong> {v.kind === "new" ? "added" : `${v.detail} updated`}</p>)}
              {it.action === "create" && it.variants.length > 0 && (
                <ul className="list-disc pl-5">
                  {it.variants.map((v) => <li key={v.name}>{v.name}{v.price_delta_pence ? ` (${v.price_delta_pence > 0 ? "+" : "−"}£${(Math.abs(v.price_delta_pence) / 100).toFixed(2)})` : ""}{v.stock !== undefined ? ` · stock ${v.stock ?? "plenty"}` : ""}</li>)}
                </ul>
              )}
              {it.variants.length > 0 && it.action === "update" && <p className="text-xs text-ink-muted">Options not in your file are left exactly as they are — an import never removes one.</p>}
            </div>
          )}
        </>
      ) : null}
    </li>
  );
}
