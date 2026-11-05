"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSuggester, type SuggestState } from "@/lib/search-client";
import { KIND_LABEL, SCOPE_NOUN, cleanQuery, hrefFor, searchHrefScoped, submitHref, subtitleFor, type SearchHit, type SearchScope, type SearchSubmit } from "@/lib/search";

/**
 * SiteSearch — THE search box. Every search box on OneShetland is this component, so they look and behave the same:
 * the header, the homepage hero, the Directory, Jobs, Boats, Spik and What's On.
 *
 *   scope    which sources the suggestions come from ("all", or one kind). One request per pause in typing, whatever the scope.
 *   submit   where Enter / the Search button goes in a contextual box: the section's OWN results page with its filters kept
 *            (e.g. /directory?category=retail&q=…). Omitted for scope "all" (-> /search). It is a real GET form, so it also works
 *            without JavaScript.
 *   variant  "plain" = just the input (header); "bar" = input + Search button in the section colour (`accent`); "hero" = on photos.
 *
 * A contextual box also offers a discreet "Search all OneShetland" row. WAI-ARIA combobox + listbox: ↓/↑ move, Home/End jump,
 * Enter opens the highlighted suggestion (else the section results), Esc closes. Suggestions start at 2 characters, are debounced
 * (300 ms) and outdated requests are aborted (lib/search-client.ts). Loading, no-match and unavailable are three different states.
 */
export type SiteSearchProps = {
  scope?: SearchScope;
  submit?: SearchSubmit;
  variant?: "plain" | "bar" | "hero";
  accent?: string;
  autoFocus?: boolean;
  onNavigate?: () => void;
  placeholder?: string;
  initial?: string;
  /** Accessible name of the input. */
  label?: string;
  id?: string;
  /** false = no live suggestions (a plain, filter-keeping search form), e.g. the Jobs page's Shifts tab until shifts have suggestions of their own. */
  suggest?: boolean;
};

export function SiteSearch({ scope = "all", submit, variant = "plain", accent, autoFocus = false, onNavigate, placeholder = "Search businesses, events, jobs, boats…", initial = "", label = "Search OneShetland", id, suggest = true }: SiteSearchProps) {
  const router = useRouter();
  const uid = useId();
  const inputId = id ?? `${uid}-input`;
  const listId = `${uid}-list`;
  const [text, setText] = useState(initial);
  const [state, setState] = useState<SuggestState>({ status: "idle" });
  const [open, setOpen] = useState(false); // the panel opens on typing/focus, never on first paint
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const suggester = useRef<ReturnType<typeof createSuggester> | null>(null);

  useEffect(() => {
    suggester.current = createSuggester({ scope, onState: (s) => { setState(s); setActive(-1); } });
    return () => suggester.current?.close();
  }, [scope]);
  useEffect(() => { if (autoFocus) inputRef.current?.focus(); }, [autoFocus]);
  useEffect(() => {
    const away = (e: Event) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("touchstart", away, { passive: true });
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("touchstart", away); };
  }, []);

  const q = cleanQuery(text);
  const contextual = scope !== "all";
  const hits: SearchHit[] = state.status === "ok" ? state.results : [];
  const mainHref = (term: string) => (submit ? submitHref(submit, term) : searchHrefScoped(term, scope));

  // Rows: every suggestion, then (when something is typed) the section's own results, then — in a contextual box — "Search all".
  type Row = { type: "hit"; hit: SearchHit } | { type: "section" } | { type: "all" };
  const rows: Row[] = useMemo(() => [
    ...hits.map((hit) => ({ type: "hit" as const, hit })),
    ...(q ? [{ type: "section" as const }] : []),
    ...(q && contextual ? [{ type: "all" as const }] : []),
  ], [hits, q, contextual]);
  const showPanel = suggest && open && q.length > 0;

  const go = (href: string) => { setOpen(false); onNavigate?.(); router.push(href); };
  const choose = (i: number) => {
    const r = rows[i];
    if (!r) return go(mainHref(q));
    if (r.type === "hit") return go(hrefFor(r.hit.kind, r.hit.ref));
    if (r.type === "all") return go(searchHrefScoped(q, "all"));
    go(mainHref(q));
  };
  const enter = () => { if (active >= 0) choose(active); else if (q) go(mainHref(q)); };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => (rows.length ? (a + 1) % rows.length : -1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (rows.length ? (a <= 0 ? rows.length - 1 : a - 1) : -1)); }
    else if (e.key === "Home" && showPanel && active >= 0) { e.preventDefault(); setActive(0); }
    else if (e.key === "End" && showPanel && active >= 0) { e.preventDefault(); setActive(rows.length - 1); }
    else if (e.key === "Enter") { e.preventDefault(); enter(); }
    else if (e.key === "Escape") { if (showPanel) { e.preventDefault(); setOpen(false); } else setText(""); }
  };

  const noun = SCOPE_NOUN[scope];
  const announce =
    state.status === "ok" ? `${hits.length} suggestion${hits.length === 1 ? "" : "s"}. Use the up and down arrow keys.`
    : state.status === "empty" ? "No suggestions." : state.status === "unavailable" ? "Search suggestions are unavailable right now." : state.status === "loading" ? "Searching…" : "";

  const shell = variant === "hero" ? "bg-paper shadow-soft" : "bg-paper border border-line-strong focus-within:border-navy focus-within:ring-2 focus-within:ring-navy/20";
  const fields = submit ? Object.entries(submit.params ?? {}).flatMap(([k, v]) => (Array.isArray(v) ? v : v == null ? [] : [v]).filter((x) => x !== "").map((x, i) => ({ k, x, i }))) : [];

  return (
    <div ref={boxRef} className="relative w-full">
      <form role="search" action={submit?.path ?? "/search"} method="get" onSubmit={(e) => { e.preventDefault(); enter(); }}>
        {/* No-JavaScript fallback: the same GET the section already used, with its filters carried as hidden fields. */}
        {fields.map((f) => <input key={`${f.k}-${f.i}`} type="hidden" name={f.k} value={f.x} />)}
        {!submit && scope !== "all" && <input type="hidden" name="scope" value={scope} />}
        <label htmlFor={inputId} className="sr-only">{label}</label>
        <div className={"flex items-center gap-2 overflow-hidden rounded-pill pl-4 " + shell + (variant === "bar" || variant === "hero" ? " pr-1" : " pr-4")}>
          <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="shrink-0 text-ink-soft"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input
            ref={inputRef}
            id={inputId}
            name={submit?.param ?? "q"}
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
            onChange={(e) => { setText(e.target.value); setOpen(true); if (suggest) suggester.current?.input(e.target.value); }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKey}
            className="min-h-[44px] w-full min-w-0 bg-transparent text-base text-ink outline-none placeholder:text-ink-soft/70"
          />
          {state.status === "loading" && <span aria-hidden className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-line-strong border-t-navy" />}
          {(variant === "bar" || variant === "hero") && (
            <button type="submit" className="min-h-[40px] shrink-0 rounded-pill px-4 text-sm font-bold text-paper transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
              style={{ background: accent ?? "#0b3a5c" }}>
              Search
            </button>
          )}
        </div>
      </form>
      <p role="status" aria-live="polite" className="sr-only">{announce}</p>

      {showPanel && (
        <div className="absolute left-0 right-0 z-[60] mt-2 overflow-hidden rounded-2xl border border-line bg-paper text-left shadow-lift">
          <ul id={listId} role="listbox" aria-label="Search suggestions" className="max-h-[min(60vh,28rem)] overflow-y-auto py-1">
            {rows.map((r, i) => (
              <li key={r.type === "hit" ? `${r.hit.kind}:${r.hit.ref}` : r.type} id={`${uid}-opt-${i}`} role="option" aria-selected={i === active}
                  onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(i)}
                  className={"flex min-h-[44px] cursor-pointer items-center gap-3 px-4 py-2.5 " + (i === active ? "bg-sand " : "") + (r.type === "hit" ? "" : "border-t border-line ") + (r.type === "section" ? "text-navy" : r.type === "all" ? "text-ink-soft" : "")}>
                {r.type === "hit" ? (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.95rem] font-semibold text-ink">{r.hit.title}</span>
                      <span className="block truncate text-xs text-ink-soft">{subtitleFor(r.hit)}</span>
                    </span>
                    {scope === "all" && <span className="shrink-0 rounded-pill border border-line-strong px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-ink-soft">{KIND_LABEL[r.hit.kind]}</span>}
                  </>
                ) : r.type === "section" ? (
                  <span className="text-sm font-semibold">{contextual ? `See all ${noun} results for` : "See all results for"} &ldquo;{q}&rdquo;</span>
                ) : (
                  <span className="text-sm">Search all OneShetland for &ldquo;{q}&rdquo;</span>
                )}
              </li>
            ))}
          </ul>
          {state.status === "loading" && hits.length === 0 && <p className="px-4 py-3 text-sm text-ink-soft">Searching…</p>}
          {state.status === "empty" && <p className="px-4 py-3 text-sm text-ink-soft">No {contextual ? noun : "matches"} found for &ldquo;{q}&rdquo; yet. Try fewer letters or a different spelling.</p>}
          {state.status === "unavailable" && <p className="px-4 py-3 text-sm text-ink-soft">Suggestions are unavailable just now. Press Enter to search.</p>}
          {state.status === "ok" && hits.some((h) => h.close) && !hits.some((h) => !h.close) && <p className="border-t border-line px-4 py-2 text-xs text-ink-soft">No exact match — these are the closest.</p>}
        </div>
      )}
    </div>
  );
}
