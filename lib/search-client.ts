import { DEBOUNCE_MS, cleanQuery, type SearchHit } from "./search.ts";

/**
 * The browser side of live suggestions, with no React in it so it can be tested directly.
 *   - nothing is requested until the cleaned text has 2+ characters;
 *   - input is debounced (300 ms): only the last pause in typing makes a request;
 *   - starting a new request aborts the previous one, and a late answer for old text is ignored;
 *   - the same text is not requested twice in a row; recent answers are reused for 30 s (a tiny in-browser cache);
 *   - the state is always one of idle | loading | ok | empty | unavailable.
 */
export type SuggestState =
  | { status: "idle" }
  | { status: "loading"; q: string }
  | { status: "ok"; q: string; results: SearchHit[] }
  | { status: "empty"; q: string }
  | { status: "unavailable"; q: string };

export function createSuggester(opts: { onState: (s: SuggestState) => void; fetchImpl?: typeof fetch; debounceMs?: number; endpoint?: string; now?: () => number }) {
  const { onState } = opts;
  const debounceMs = opts.debounceMs ?? DEBOUNCE_MS;
  const endpoint = opts.endpoint ?? "/api/search/suggest";
  const now = opts.now ?? Date.now;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let ctrl: AbortController | undefined;
  let latest = "";
  const memo = new Map<string, { at: number; results: SearchHit[] }>();

  const cancel = () => { if (timer) clearTimeout(timer); timer = undefined; ctrl?.abort(); ctrl = undefined; };

  async function run(q: string) {
    ctrl?.abort();
    const c = new AbortController(); ctrl = c;
    onState({ status: "loading", q });
    try {
      const res = await (opts.fetchImpl ?? fetch)(`${endpoint}?q=${encodeURIComponent(q)}`, { signal: c.signal, headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(String(res.status));
      const j = (await res.json()) as { results?: SearchHit[]; unavailable?: boolean };
      if (latest !== q || c.signal.aborted) return; // outdated answer
      if (j.unavailable) return onState({ status: "unavailable", q });
      const results = Array.isArray(j.results) ? j.results : [];
      memo.set(q.toLowerCase(), { at: now(), results });
      onState(results.length ? { status: "ok", q, results } : { status: "empty", q });
    } catch {
      if (c.signal.aborted || latest !== q) return;
      onState({ status: "unavailable", q });
    }
  }

  return {
    input(raw: string) {
      const q = cleanQuery(raw);
      latest = q;
      cancel();
      if (!q) return onState({ status: "idle" });
      const hit = memo.get(q.toLowerCase());
      if (hit && now() - hit.at < 30_000) return onState(hit.results.length ? { status: "ok", q, results: hit.results } : { status: "empty", q });
      onState({ status: "loading", q });
      timer = setTimeout(() => void run(q), debounceMs);
    },
    close() { latest = ""; cancel(); },
  };
}
