import { trend, trendText, num } from "@/lib/admin-intel";

/** A KPI card with a previous-period comparison. `goodWhen` says which direction is good, so a rise in failures is not painted green. */
export function IntelKpi({ label, value, display, cur, prev, days, hint, goodWhen = "up" }: {
  label: string; value?: number; display?: string; cur?: number; prev?: number; days?: number; hint?: string; goodWhen?: "up" | "down";
}) {
  const t = cur !== undefined && prev !== undefined ? trend(cur, prev) : null;
  const good = t && (t.dir === "up" || t.dir === "new") ? goodWhen === "up" : t && t.dir === "down" ? goodWhen === "down" : null;
  const tone = good === null ? "text-ink-muted" : good ? "text-emerald-700" : "text-rose-600";
  const arrow = !t ? "" : t.dir === "up" ? "▲ " : t.dir === "down" ? "▼ " : t.dir === "new" ? "● " : "";
  return (
    <div className="rounded-card border border-line bg-paper p-3.5 shadow-soft sm:p-4">
      <p className="font-display text-2xl font-bold text-ink sm:text-3xl">{display ?? num(value)}</p>
      <p className="mt-0.5 text-sm font-semibold text-ink-soft">{label}</p>
      {t && days !== undefined && <p className={"mt-1 text-xs font-semibold " + tone}>{arrow}{trendText(cur!, prev!, days)}</p>}
      {hint && <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

/** Small accessible bar chart (hand-drawn, no library). Values are listed for screen readers. */
export function MiniBars({ data, label, height = 72 }: { data: { label: string; value: number }[]; label: string; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = Math.max(1, data.length);
  const w = 300, gap = n > 45 ? 0 : 1, bw = Math.max(1, w / n - gap);
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${w} ${height}`} className="h-auto w-full" role="img" aria-label={`${label}. Highest day ${max}.`} preserveAspectRatio="none">
        {data.map((d, i) => {
          const h = d.value === 0 ? 1 : Math.max(2, (d.value / max) * (height - 2));
          return <rect key={d.label + i} x={i * (w / n)} y={height - h} width={bw} height={h} rx={1} className={d.value === 0 ? "fill-line" : "fill-teal"}><title>{`${d.label}: ${d.value}`}</title></rect>;
        })}
      </svg>
      <figcaption className="mt-1 flex justify-between text-[11px] text-ink-muted"><span>{data[0]?.label}</span><span>{data[data.length - 1]?.label}</span></figcaption>
    </figure>
  );
}

/** Ranked horizontal bars with the number on each row; readable at phone width. */
export function BarList({ rows, empty = "Nothing to show yet." }: { rows: { label: string; value: number }[]; empty?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="text-sm text-ink-muted">{empty}</p>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm"><span className="min-w-0 truncate font-semibold text-ink">{r.label}</span><span className="shrink-0 font-bold text-ink">{num(r.value)}</span></div>
          <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-sand"><div className="h-full rounded-full bg-teal" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

export function Panel({ title, sub, children, id }: { title: string; sub?: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="rounded-card border border-line bg-paper p-4 shadow-soft sm:p-5">
      <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
      {sub && <p className="mt-0.5 text-xs text-ink-muted">{sub}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Label/value rows for a small facts table that stays one column on a phone. */
export function Facts({ rows }: { rows: { label: string; value: string; note?: string }[] }) {
  return (
    <dl className="divide-y divide-line">
      {rows.map((r) => (
        <div key={r.label} className="flex items-baseline justify-between gap-4 py-2 text-sm">
          <dt className="text-ink-soft">{r.label}{r.note && <span className="block text-xs text-ink-muted">{r.note}</span>}</dt>
          <dd className="shrink-0 font-bold text-ink">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
