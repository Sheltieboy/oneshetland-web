/**
 * errorMessage — get something a human can act on out of an unknown throw.
 *
 * `e instanceof Error ? e.message : "Something went wrong"` is repeated across
 * ~80 files, and it discards exactly the errors we most need to see. Supabase
 * throws a PostgrestError: a PLAIN OBJECT with message, details, hint and code.
 * It is not an Error, so every one of those handlers falls through to its
 * generic fallback and the real cause is lost.
 *
 * That is how "Could not save the event." came to be shown instead of the
 * constraint that actually failed.
 */
export function errorMessage(e: unknown, fallback = "Something went wrong."): string {
  if (typeof e === "string" && e.trim()) return e;
  if (e instanceof Error && e.message) return e.message;

  if (e && typeof e === "object") {
    const o = e as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const parts = [o.message, o.details].filter((p): p is string => typeof p === "string" && !!p.trim());
    if (parts.length) {
      // The code is what makes a Postgres error searchable — keep it.
      const code = typeof o.code === "string" && o.code ? ` (${o.code})` : "";
      return `${[...new Set(parts)].join(" — ")}${code}`;
    }
  }
  return fallback;
}
