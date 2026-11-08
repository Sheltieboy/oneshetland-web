"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useSaved } from "@/components/saved/context";
import {
  SAVED_FILTERS, canUndoRemove, chunk, itemHref, itemRef, matchesFilter, refKey, saveOutcome, sectionize,
  type SavedFilter, type SavedItem, type SavedListResult, type SavedType,
} from "@/lib/saved";
import { CLEAR_PAST, EMPTY, FILTER_LABEL, MORE_NOTE, MSG, SAVED_PRIVATE_NOTE, SNAPSHOT_NOTE, TYPE_LABEL, knownState, labelFor, savedOn, whenLine } from "@/lib/saved-copy";

const ICON: Record<SavedType, string> = {
  event: "M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
  activity: "M4 12a8 8 0 0 1 14-5.3M20 4v4h-4M20 12a8 8 0 0 1-14 5.3M4 20v-4h4",
  job: "M4 8h16v11H4zM9 8V5h6v3M4 13h16",
  business: "M4 10l1.5-5h13L20 10M4 10v9h16v-9M4 10h16M10 19v-5h4v5",
};

/** The reasons a row is shown in a warning colour. Words carry the meaning; colour is only a hint. */
const WARN = new Set(["cancelled", "break", "changed", "date_gone", "no_upcoming", "closed", "filled", "snapshot_postponed"]);

function Row({ item, onRemove, busy }: { item: SavedItem; onRemove: (i: SavedItem) => void; busy: boolean }) {
  const state = knownState(item.state);
  const label = labelFor({ ...item, state });
  const href = itemHref({ ...item, state });
  const snapshot = item.from_snapshot || state.startsWith("snapshot_");
  const gone = state === "unavailable";
  const title = gone ? "No longer available" : item.title ?? TYPE_LABEL[item.item_type];
  const when = gone || state === "date_gone" ? null : whenLine(item);
  const dim = state === "past" || snapshot || gone;
  const name = gone ? `${TYPE_LABEL[item.item_type]} saved ${savedOn(item.saved_at).replace("Saved ", "")}` : title;
  return (
    <li className="flex items-start gap-3 border-b border-line px-4 py-3 last:border-0">
      <span aria-hidden className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sand text-ink-soft">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={ICON[item.item_type]} /></svg>
      </span>
      <div className={"min-w-0 flex-1 " + (dim ? "text-ink-soft" : "text-ink")}>
        <p className="text-[11px] font-bold uppercase tracking-widest text-ink-muted">{TYPE_LABEL[item.item_type]}</p>
        <p className="font-display text-lg font-bold leading-snug">
          {href ? <Link href={href} className="hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy">{title}</Link> : title}
        </p>
        {(when || item.place) && !gone && <p className="text-sm text-ink-soft">{[when, item.place].filter(Boolean).join(" · ")}</p>}
        {label && (
          <p className="mt-1">
            <span className={"inline-block rounded-pill px-2.5 py-0.5 text-xs font-bold " + (WARN.has(state) ? "bg-amber-100 text-amber-950" : "bg-sand text-ink-soft")}>{label}</span>
          </p>
        )}
        {item.note && !gone && !snapshot && <p className="mt-1 text-sm text-ink-soft">{item.note}</p>}
        {state === "date_gone" && href && <p className="mt-1 text-sm"><Link href={href} className="font-semibold underline underline-offset-2">See current dates</Link></p>}
        <p className="mt-1 text-xs text-ink-muted">{snapshot && <>{SNAPSHOT_NOTE} · </>}{savedOn(item.saved_at)}</p>
      </div>
      <button
        type="button" onClick={() => onRemove(item)} disabled={busy}
        aria-label={`Remove ${name} from My Saved`}
        className="min-h-[44px] shrink-0 rounded-pill border border-line-strong px-4 text-sm font-semibold text-ink hover:bg-sand disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
      >
        Remove
      </button>
    </li>
  );
}

function Section({ title, id, items, ...rest }: { title: string; id: string; items: SavedItem[]; onRemove: (i: SavedItem) => void; busy: boolean }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby={id} className="mt-8">
      <h2 id={id} className="font-display text-xl font-bold text-ink">{title}</h2>
      <ul className="mt-3 rounded-xl border border-line bg-paper shadow-soft">
        {items.map((i) => <Row key={refKey(itemRef(i))} item={i} {...rest} />)}
      </ul>
    </section>
  );
}

/**
 * The My Saved list. Filters (All, Events with activities, Jobs, Businesses); Coming up, Saved, and a collapsed Past and unavailable section
 * with "Clear past". Every row's wording comes from lib/saved-copy.ts; a snapshot row says it is "As it was when you saved it". Hidden
 * duplicates (a date that is also saved as a whole) are not shown. Remove offers Undo only where the old row can really come back.
 */
export function SavedList({ initial }: { initial: SavedListResult }) {
  const router = useRouter();
  const confirm = useConfirm();
  const api = useSaved();
  const [filter, setFilter] = useState<SavedFilter>("all");
  const [removed, setRemoved] = useState<ReadonlySet<string>>(() => new Set());
  const [busy, setBusy] = useState(false);

  const items = useMemo(() => initial.items.filter((i) => !removed.has(refKey(itemRef(i)))), [initial.items, removed]);
  const sections = useMemo(() => sectionize(items, filter), [items, filter]);
  const visible = sections.comingUp.length + sections.saved.length + sections.past.length;
  const hide = (keys: string[], on: boolean) => setRemoved((prev) => { const n = new Set(prev); for (const k of keys) { if (on) n.add(k); else n.delete(k); } return n; });

  async function remove(item: SavedItem) {
    const ref = itemRef(item), k = refKey(ref);
    setBusy(true);
    try {
      const undo = canUndoRemove({ ...item, state: knownState(item.state) });
      const out = await api.unsave(ref, { undo, onUndo: () => hide([k], false) });
      if (out === "ok") hide([k], true);
      else if (out === "signin") router.push("/sign-in?next=/account/saved");
    } finally { setBusy(false); }
  }

  async function clearPast() {
    const rows = sections.past;
    if (rows.length === 0) return;
    const yes = await confirm({ title: CLEAR_PAST.title, body: CLEAR_PAST.body(rows.length), confirmLabel: CLEAR_PAST.confirm, danger: true });
    if (!yes) return;
    setBusy(true);
    let cleared = 0;
    try {
      const sb = createClient();
      for (const part of chunk(rows)) {
        const { data, error } = await sb.rpc("unsave_many", { p_items: part.map((i) => ({ type: i.item_type, item: i.item_id, occurrence: i.occurrence_key ?? null })) });
        const out = saveOutcome({ data, error });
        if (out === "signin") { router.push("/sign-in?next=/account/saved"); return; }
        if (out !== "ok") { api.announce(MSG.failedRemove); break; }
        hide(part.map((i) => refKey(itemRef(i))), true);
        cleared += part.length;
      }
      if (cleared > 0) api.announce(CLEAR_PAST.done(cleared));
    } catch {
      api.announce(MSG.failedRemove);
    } finally { setBusy(false); }
  }

  const counts = (f: SavedFilter) => items.filter((i) => !i.shadowed && matchesFilter(i, f)).length;

  return (
    <div>
      <p className="text-sm text-ink-muted">{SAVED_PRIVATE_NOTE}</p>
      <div role="group" aria-label="Show" className="mt-4 flex flex-wrap gap-2">
        {SAVED_FILTERS.map((f) => (
          <button
            key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}
            className={"min-h-[44px] rounded-pill px-4 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy " + (filter === f ? "bg-navy text-paper" : "border border-line-strong text-ink-soft hover:bg-sand")}
          >
            {FILTER_LABEL[f]} <span className={filter === f ? "text-paper/80" : "text-ink-muted"}>({counts(f)})</span>
          </button>
        ))}
      </div>

      {visible === 0 && <p className="mt-8 rounded-xl border border-dashed border-line bg-paper/60 px-6 py-10 text-center text-sm text-ink-muted">{items.length === 0 ? EMPTY.body : EMPTY.filtered}</p>}

      <Section id="saved-coming" title="Coming up" items={sections.comingUp} onRemove={remove} busy={busy} />
      <Section id="saved-saved" title="Saved" items={sections.saved} onRemove={remove} busy={busy} />

      {sections.past.length > 0 && (
        <section aria-labelledby="saved-past" className="mt-8">
          <details className="group rounded-xl border border-line bg-paper shadow-soft">
            <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy [&::-webkit-details-marker]:hidden">
              <h2 id="saved-past" className="font-display text-xl font-bold text-ink">Past and unavailable <span className="text-base font-normal text-ink-muted">({sections.past.length})</span></h2>
              <span aria-hidden className="text-lg leading-none transition group-open:rotate-45 motion-reduce:transition-none">+</span>
            </summary>
            <div className="border-t border-line">
              <div className="flex justify-end px-4 py-3">
                <button type="button" onClick={() => void clearPast()} disabled={busy} className="min-h-[44px] rounded-pill border border-line-strong px-4 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy">
                  {CLEAR_PAST.button}
                </button>
              </div>
              <ul>{sections.past.map((i) => <Row key={refKey(itemRef(i))} item={i} onRemove={remove} busy={busy} />)}</ul>
            </div>
          </details>
        </section>
      )}

      {initial.more && <p className="mt-6 text-sm text-ink-muted">{MORE_NOTE}</p>}
    </div>
  );
}
