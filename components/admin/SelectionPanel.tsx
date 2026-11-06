type Snap = Record<string, unknown> | null;
type Item = { id?: string; title?: string; organiser?: string; category?: string; reason?: string; label?: string };
const arr = (v: unknown): Item[] => (Array.isArray(v) ? (v as Item[]) : []);
const when = (v: unknown) => (typeof v === "string" ? new Date(v).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : "");

/** What the Regular Activities roundup and Accessible Shetland recipes last selected, and what they left out and why. Read-only. */
export function SelectionPanel({ regular, accessible }: { regular: Snap; accessible: Snap }) {
  if (!regular && !accessible) return null;
  const counts = (regular?.counts ?? {}) as Record<string, number>;
  const chosenA = (accessible?.chosen ?? null) as Item | null;
  return (
    <section aria-labelledby="sel-h" className="mt-8 rounded-card border border-line bg-white p-5 shadow-soft">
      <h2 id="sel-h" className="font-display text-lg font-bold text-navy">What the newest recipes last selected</h2>
      <p className="mt-1 text-xs text-ink-muted">Written on each real composer run. Nothing here posts anything.</p>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        {regular && (
          <div>
            <h3 className="text-sm font-bold">Regular activities roundup <span className="font-normal text-ink-muted">· {when(regular.at)}</span></h3>
            <p className="text-xs text-ink-soft">Week starting {String(regular.monday)}, posting {String(regular.postDay)}. {counts.listed ?? 0} listed, {counts.qualifying ?? 0} qualifying, {counts.chosen ?? 0} chosen.</p>
            {typeof regular.reason === "string" && <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">Skipped: {regular.reason}</p>}
            <ul className="mt-2 space-y-1 text-sm">{arr(regular.chosen).map((c) => <li key={c.id}><strong>{c.title}</strong> <span className="text-ink-soft">· {c.organiser} · {c.category}</span></li>)}</ul>
            {arr(regular.excluded).length > 0 && (
              <details className="mt-2"><summary className="cursor-pointer text-xs font-semibold text-ink-soft">Left out ({arr(regular.excluded).length})</summary>
                <ul className="mt-1 space-y-0.5 text-xs text-ink-soft">{arr(regular.excluded).map((c) => <li key={c.id}>{c.title}: {c.reason}</li>)}</ul></details>
            )}
          </div>
        )}
        {accessible && (
          <div>
            <h3 className="text-sm font-bold">Accessible Shetland <span className="font-normal text-ink-muted">· {when(accessible.at)}</span></h3>
            <p className="text-xs text-ink-soft">Formats tried: {Array.isArray(accessible.tried) ? (accessible.tried as string[]).join(" → ") : "none"}.</p>
            {typeof accessible.reason === "string" && <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">Skipped: {accessible.reason}</p>}
            {chosenA && <p className="mt-1 text-sm"><strong>{String(accessible.format)}</strong>: {chosenA.label}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
