/**
 * home-resilience.ts — keeps the homepage rendering when Supabase (or any dependency) is slow.
 *
 * `resilient(key, opts, loader)` wraps ONE non-essential, ANONYMOUS, public loader:
 *   - fresh copy (younger than ttlMs)      -> returned at once, no database call;
 *   - otherwise the loader runs under a hard deadline (deadlineMs);
 *   - on success the copy is stored and returned;
 *   - on timeout or error the last good copy is returned if it is younger than staleMs, else `fallback`.
 * Concurrent callers share one in-flight load. A loader that outlives its deadline keeps running and, if it
 * finishes, refreshes the copy for the next visitor. A non-empty copy is never replaced by an empty result
 * younger than emptyGuardMs, because several loaders swallow their own errors and return [] on failure.
 *
 * NEVER wrap anything personal: signed-in data, accounts, payments, tokens. Per server instance, in memory,
 * best effort: nothing here is shared between visitors' private data because no private data goes through it.
 * Set HOME_RESILIENCE=off in the environment to bypass the copy (deadline and fallback still apply).
 */
export type ResilientOpts<T> = {
  ttlMs: number;
  deadlineMs: number;
  staleMs: number;
  fallback: T;
  /** Treat this result as "possibly a swallowed failure". Default: empty array / null / undefined. */
  isEmpty?: (v: T) => boolean;
  emptyGuardMs?: number;
};

type Entry = { value: unknown; at: number };
const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

export function __resetHomeResilience() { store.clear(); inflight.clear(); }

const defaultEmpty = (v: unknown) => v == null || (Array.isArray(v) && v.length === 0);

export async function resilient<T>(key: string, opts: ResilientOpts<T>, loader: () => Promise<T>, now: () => number = Date.now): Promise<T> {
  const off = process.env.HOME_RESILIENCE === "off";
  const cur = store.get(key);
  if (!off && cur && now() - cur.at < opts.ttlMs) return cur.value as T;

  let p = inflight.get(key) as Promise<T> | undefined;
  if (!p) {
    p = (async () => {
      const v = await loader();
      const isEmpty = opts.isEmpty ?? defaultEmpty;
      const prev = store.get(key);
      const guard = opts.emptyGuardMs ?? 5 * 60_000;
      if (!(prev && !isEmpty(prev.value as T) && isEmpty(v) && now() - prev.at < guard)) store.set(key, { value: v, at: now() });
      else return prev.value as T;
      return v;
    })();
    inflight.set(key, p);
    const clear = () => { if (inflight.get(key) === p) inflight.delete(key); };
    p.then(clear, clear);
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new Error("deadline")), opts.deadlineMs); }),
    ]);
  } catch {
    p.catch(() => {}); // a late failure must not become an unhandled rejection
    // A load that missed its deadline must not pin the key: the next visitor starts a fresh one (the late one may still refresh the copy).
    if (inflight.get(key) === p) inflight.delete(key);
    const stale = store.get(key);
    if (!off && stale && now() - stale.at < opts.staleMs) return stale.value as T;
    return opts.fallback;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
