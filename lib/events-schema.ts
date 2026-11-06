/**
 * events-schema.ts - capability-tolerant reads for the Events & Activities migration.
 *
 * The migration (events.organiser_name / source / is_dated_run and the event_occurrences table) reaches production later, in a
 * controlled release. Every loader must work BEFORE it (columns and table absent: behave exactly as today) and AFTER it.
 *
 *   selectTolerant(build): runs build(NEW_EXTRA) first. If the database says a column or relation is missing (Postgres 42703 /
 *   42P01, PostgREST PGRST204 / PGRST205 / PGRST200 / PGRST100 on an unknown embed) it runs build("") - the unchanged legacy
 *   select - and reports modern=false. Any other error is NOT treated as a schema problem and is returned as it is.
 *
 * NOTHING is remembered between calls: the very first request after the migration is applied already sees the new shape. The price
 * is one cheap failing request per read while the schema is still old.
 *
 * Pure of server-only imports so tests can load it directly.
 */

/** What the new schema adds to an events select: three columns and the performances embed. */
export const OCCURRENCE_EMBED = "occurrences:event_occurrences(id,starts_at,ends_at,status,venue,locality,note)";
export const NEW_EVENT_COLUMNS = "organiser_name, source, is_dated_run";
export const NEW_EXTRA = `, ${NEW_EVENT_COLUMNS}, ${OCCURRENCE_EMBED}`;

type PgError = { code?: string | null; message?: string | null; details?: string | null; hint?: string | null } | null | undefined;

const MISSING_CODES = new Set(["42703", "42P01", "PGRST204", "PGRST205", "PGRST200"]);

/** True when the error means "this column / table / relationship does not exist (yet)". */
export function isSchemaMissing(error: PgError): boolean {
  if (!error) return false;
  if (error.code && MISSING_CODES.has(error.code)) return true;
  const text = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return (
    /column .* does not exist/.test(text) ||
    /relation .* does not exist/.test(text) ||
    /could not find the .* column/.test(text) ||
    /could not find a relationship/.test(text) ||
    /could not find the table/.test(text)
  );
}

export type Tolerant<T> = { data: T | null; error: PgError; modern: boolean };

/**
 * Tries ONLY the new-schema select. `modern: false` (and no data) means the schema is still the old one - the caller then runs its own
 * unchanged legacy path. Any other failure is returned as modern: true with the error and no data (a real outage is not a schema problem).
 */
export async function selectModern<T = Record<string, unknown>[]>(
  build: (extra: string) => PromiseLike<{ data: unknown; error?: PgError }>,
): Promise<Tolerant<T>> {
  try {
    const r = await build(NEW_EXTRA);
    if (!r.error) return { data: (r.data ?? null) as T | null, error: null, modern: true };
    if (isSchemaMissing(r.error)) return { data: null, error: r.error, modern: false };
    return { data: null, error: r.error, modern: true };
  } catch {
    return { data: null, error: { message: "request failed" }, modern: true };
  }
}

/** New-schema select first; on a missing column / relation the same query with no extras (the legacy select). Same shape either way. */
export async function selectTolerant<T = Record<string, unknown>[]>(
  build: (extra: string) => PromiseLike<{ data: unknown; error?: PgError }>,
): Promise<Tolerant<T>> {
  const first = await selectModern<T>(build);
  if (first.modern) return first;
  try {
    const second = await build("");
    return { data: (second.data ?? null) as T | null, error: second.error ?? null, modern: false };
  } catch {
    return { data: null, error: { message: "request failed" }, modern: false };
  }
}
