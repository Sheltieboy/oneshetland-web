"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSuggester, type SuggestState } from "@/lib/search-client";
import { KIND_LABEL, cleanQuery, hrefFor, searchHref, subtitleFor, type SearchHit } from "@/lib/search";

/**
 * SiteSearch — the live search box (WAI-ARIA combobox with a listbox popup).
 * Suggestions start at 2 characters, are debounced (300 ms) and outdated requests are aborted (lib/search-client.ts).
 * Keyboard: ↓/↑ move, Home/End jump, Enter opens the highlighted suggestion (or the full results page when none is
 * highlighted), Esc closes. The last row is always "See all results for …". Screen readers hear the result count
 * through a polite live region.
 */
export function SiteSearch({ autoFocus = false, onNavigate, placeholder = "Search businesses, events, jobs, boats…", initial = "" }: { autoFocus?: boolean; onNavigate?: () => void; placeholder?: string; initial?: string }) {
  const router = useRouter();
  const uid = useId();
  const listId = `${uid}-list`;
  const [text, setText] = useState(initial);
  const [state, setState] = useState<SuggestState>({ status: "idle" });
  const [open, setOpen] = useState(false); // the panel opens on typing/focus, never on first paint
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const suggester = useRef<ReturnType<typeof createSuggester> | null>(null);

  useEffect(() => {
    suggester.current = createSuggester({ onState: (s) => { setState(s); setActive(-1); } });
    return () => suggester.current?.close();
  }, []);
  useEffect(() => { if (autoFocus) inputRef.current?.focus(); }, [autoFocus]);
  useEffect(() => {
    const away = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  const q = cleanQuery(text);
  const hits: SearchHit[] = state.status === "ok" ? state.results : [];
  // Rows: every suggestion, then the "see all" row (when there is something typed).
  const rows = useMemo(() => [...hits.map((h) => ({ type: "hit" as const, hit: h })), ...(q ? [{ type: "all" as const }] : [])], [hits, q]);
  const showPanel = open && q.length > 0;

  const go = (href: string) => { setOpen(false); onNavigate?.(); router.push(href); };
  const choose = (i: number) => {
    const r = rows[i];
    if (!r) return go(searchHref(q || text.trim()));
    go(r.type === "hit" ? hrefFor(r.hit.kind, r.hit.ref) : searchHref(q));
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => (rows.length ? (a + 1) % rows.length : -1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (rows.length ? (a <= 0 ? rows.length - 1 : a - 1) : -1)); }
    else if (e.key === "Home" && showPanel && active >= 0) { e.preventDefault(); setActive(0); }
    else if (e.key === "End" && showPanel && active >= 0) { e.preventDefault(); setActive(rows.length - 1); }
    else if (e.key === "Enter") { e.preventDefault(); if (active >= 0) choose(active); else if (q) go(searchHref(q)); }
    else if (e.key === "Escape") { if (showPanel) { e.preventDefault(); setOpen(false); } else setText(""); }
  };

  const announce =
    state.status === "ok" ? `${hits.length} suggestion${hits.length === 1 ? "" : "s"}. Use the up and down arrow keys.`
    : state.status === "empty" ? "No suggestions." : state.status === "unavailable" ? "Search suggestions are unavailable right now." : state.status === "loading" ? "Searching…" : "";

  return (
    <div ref={boxRef} className="relative w-full">
      <form role="search" onSubmit={(e) => { e.preventDefault(); if (active >= 0) choose(active); else if (q) go(searchHref(q)); }}>
        <label htmlFor={`${uid}-input`} className="sr-only">Search OneShetland</label>
        <div className="flex items-center gap-2 rounded-pill border border-line-strong bg-paper px-4 focus-within:border-navy focus-within:ring-2 focus-within:ring-navy/20">
          <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="shrink-0 text-ink-soft"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input
            ref={inputRef}
            id={`${uid}-input`}
            type="search"
            role="combobox"
            aria-expanded={showPanel}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showPanel && active >= 0 ? `${uid}-opt-${active}` : undefined}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            value={text}
            placeholder={placeholder}
            onChange={(e) => { setText(e.target.value); setOpen(true); suggester.current?.input(e.target.value); }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKey}
            className="min-h-[44px] w-full bg-transparent text-base text-ink outline-none placeholder:text-ink-soft/70"
          />
          {state.status === "loading" && <span aria-hidden className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-line-strong border-t-navy" />}
        </div>
      </form>
      <p role="status" aria-live="polite" className="sr-only">{announce}</p>

      {showPanel && (
        <div className="absolute left-0 right-0 z-[60] mt-2 overflow-hidden rounded-2xl border border-line bg-paper shadow-lift">
          <ul id={listId} role="listbox" aria-label="Search suggestions" className="max-h-[min(60vh,28rem)] overflow-y-auto py-1">
            {rows.map((r, i) => (
              <li key={r.type === "hit" ? `${r.hit.kind}:${r.hit.ref}` : "all"} id={`${uid}-opt-${i}`} role="option" aria-selected={i === active}
                  onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(i)}
                  className={"flex min-h-[44px] cursor-pointer items-center gap-3 px-4 py-2.5 " + (i === active ? "bg-sand" : "") + (r.type === "all" ? " border-t border-line text-navy" : "")}>
                {r.type === "hit" ? (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.95rem] font-semibold text-ink">{r.hit.title}</span>
                      <span className="block truncate text-xs text-ink-soft">{subtitleFor(r.hit)}</span>
                    </span>
                    <span className="shrink-0 rounded-pill border border-line-strong px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-ink-soft">{KIND_LABEL[r.hit.kind]}</span>
                  </>
                ) : (
                  <span className="text-sm font-semibold">See all results for &ldquo;{q}&rdquo;</span>
                )}
              </li>
            ))}
          </ul>
          {state.status === "loading" && hits.length === 0 && <p className="px-4 py-3 text-sm text-ink-soft">Searching…</p>}
          {state.status === "empty" && <p className="px-4 py-3 text-sm text-ink-soft">No matches yet. Try fewer letters or a different spelling.</p>}
          {state.status === "unavailable" && <p className="px-4 py-3 text-sm text-ink-soft">Suggestions are unavailable just now. Press Enter to search.</p>}
          {state.status === "ok" && hits.some((h) => h.close) && !hits.some((h) => !h.close) && <p className="border-t border-line px-4 py-2 text-xs text-ink-soft">No exact match — these are the closest.</p>}
        </div>
      )}
    </div>
  );
}
