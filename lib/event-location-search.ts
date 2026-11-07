/**
 * Where-is-it suggestions for the community event form: venue search and the area list, built ONLY from records OneShetland already has.
 *  - Areas: public.areas (active, physical, never the 'shetland' wide row) plus public.place_aliases (alternative names).
 *  - Venues: public.local_businesses (read with the member's own session; RLS decides what is visible) and the venue/locality/lat/lng of
 *    previously PUBLISHED, not hidden events. There is no venues table, so nothing here creates or changes any record.
 * Pure helpers (normalise, rank, dedupe, address to area, auto-select rule) are separate from the loaders so they can be tested without a network.
 */

/** Just enough of a supabase client for the loaders (the real client and the tests' fakes both satisfy it). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LocationClient = { from: (table: string) => any };

export type Area = { id: string; name: string; official: string; type: string; parentId: string | null; parentName: string | null; sort: number };
export type Alias = { alias: string; areaId: string | null; candidateIds: string[] };

export type VenueSource = "business" | "history";
export type VenueOption = {
  key: string; name: string; source: VenueSource;
  /** Shown under the name so similarly named places can be told apart: the address for a business, the area for a past event. */
  context: string; address: string | null; locality: string | null; lat: number | null; lng: number | null;
};

// ── text helpers ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Lower case, accents and punctuation out, spaces collapsed; "the" at the front is dropped. */
export function normalise(s: string): string {
  const t = s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
  return t.replace(/^the /, "");
}

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Does `hay` (already normalised) contain `needle` (already normalised) as whole words? */
export function hasWholeWords(hay: string, needle: string): boolean {
  if (!needle) return false;
  return new RegExp(`(^| )${escRe(needle)}( |$)`).test(hay);
}

/** Strip characters that would act as wildcards inside an ilike pattern. */
export function likeTerm(q: string): string { return q.replace(/[%_\\*,()]/g, " ").replace(/\s+/g, " ").trim(); }

// ── areas ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type AreaRow = { id: unknown; name_display?: unknown; name_official?: unknown; type?: unknown; parent_id?: unknown; sort_order?: unknown };
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export function shapeAreas(rows: unknown): Area[] {
  if (!Array.isArray(rows)) return [];
  const raw = (rows as AreaRow[]).flatMap((r) => {
    const id = str(r.id), name = str(r.name_display) ?? str(r.name_official);
    return id && name && r.type !== "shetland" ? [{ id, name, official: str(r.name_official) ?? name, type: str(r.type) ?? "area", parentId: str(r.parent_id), sort: typeof r.sort_order === "number" ? r.sort_order : 0 }] : [];
  });
  const byId = new Map(raw.map((a) => [a.id, a.name]));
  return raw.map((a) => ({ ...a, parentName: a.parentId ? byId.get(a.parentId) ?? null : null }));
}

export function shapeAliases(rows: unknown): Alias[] {
  if (!Array.isArray(rows)) return [];
  return (rows as Record<string, unknown>[]).flatMap((r) => {
    const alias = str(r.alias);
    if (!alias) return [];
    const candidateIds = Array.isArray(r.candidate_ids) ? (r.candidate_ids as unknown[]).flatMap((c) => (str(c) ? [str(c)!] : [])) : [];
    return [{ alias, areaId: str(r.area_id), candidateIds }];
  });
}

/** An alias is unambiguous only when it points at exactly one area and lists no competing candidates. */
export function unambiguousAreaOf(a: Alias): string | null {
  if (a.candidateIds.length > 1) return null;
  if (a.candidateIds.length === 1) return a.areaId && a.areaId !== a.candidateIds[0] ? null : a.candidateIds[0];
  return a.areaId;
}

export type AreaIndex = { areas: Area[]; byId: Map<string, Area>; aliases: Alias[] };
export function buildAreaIndex(areas: Area[], aliases: Alias[]): AreaIndex {
  const byId = new Map(areas.map((a) => [a.id, a]));
  // Keep only aliases that point at an area we offer (an alias to the Shetland-wide row, or an inactive area, is ignored).
  const ok = aliases.filter((a) => (a.candidateIds.length ? a.candidateIds.some((c) => byId.has(c)) : !!a.areaId && byId.has(a.areaId)));
  return { areas: [...areas].sort((a, b) => a.name.localeCompare(b.name, "en-GB")), byId, aliases: ok };
}

export type AreaOptionModel = { id: string; name: string; context: string; alsoKnownAs: string | null };
const areaContext = (a: Area) => (a.parentName && a.parentName !== a.name ? a.parentName : a.type === "island" ? "Island" : "");

function toOption(a: Area, aka: string | null = null): AreaOptionModel { return { id: a.id, name: a.name, context: areaContext(a), alsoKnownAs: aka }; }

/** Areas for the box. Empty query: every area, alphabetical. Otherwise names first (exact, then starts-with, then word-start, then contains), then aliases. */
export function searchAreas(idx: AreaIndex, query: string, limit = 12): AreaOptionModel[] {
  const q = normalise(query);
  if (!q) return idx.areas.map((a) => toOption(a));
  const scored = new Map<string, { opt: AreaOptionModel; score: number }>();
  const put = (a: Area, score: number, aka: string | null) => {
    const prev = scored.get(a.id);
    if (!prev || score < prev.score) scored.set(a.id, { opt: toOption(a, aka), score });
  };
  const rank = (hay: string): number => (hay === q ? 0 : hay.startsWith(q) ? 1 : hay.split(" ").some((w) => w.startsWith(q)) ? 2 : hay.includes(q) ? 3 : 9);
  for (const a of idx.areas) {
    const s = Math.min(rank(normalise(a.name)), rank(normalise(a.official)));
    if (s < 9) put(a, s, null);
  }
  for (const al of idx.aliases) {
    const s = rank(normalise(al.alias));
    if (s >= 9) continue;
    // Ambiguous alias: offer every candidate, never one guess.
    const ids = al.candidateIds.length ? al.candidateIds : al.areaId ? [al.areaId] : [];
    for (const id of ids) { const a = idx.byId.get(id); if (a && !normalise(a.name).startsWith(q)) put(a, 4 + s, al.alias); else if (a) put(a, 4 + s, null); }
  }
  return [...scored.values()].sort((x, y) => x.score - y.score || x.opt.name.localeCompare(y.opt.name, "en-GB")).slice(0, limit).map((x) => x.opt);
}

/** Resolve a stored locality text to an area: exact (case-insensitive, punctuation-insensitive) name, official name, or an unambiguous alias. */
export function areaFromLocality(idx: AreaIndex, text: string | null | undefined): Area | null {
  const t = normalise(text ?? "");
  if (!t) return null;
  const hits = new Set<string>();
  for (const a of idx.areas) if (normalise(a.name) === t || normalise(a.official) === t) hits.add(a.id);
  if (!hits.size) for (const al of idx.aliases) if (normalise(al.alias) === t) { const id = unambiguousAreaOf(al); if (id) hits.add(id); }
  return hits.size === 1 ? idx.byId.get([...hits][0])! : null;
}

/**
 * Derive an area from a free-text address by whole-word matches of area names and UNAMBIGUOUS aliases.
 * Only an address that matches exactly one distinct area gives an answer; two or none gives null (never a guess).
 */
export function areaFromAddress(idx: AreaIndex, address: string | null | undefined): Area | null {
  const h = normalise(address ?? "");
  if (!h) return null;
  const hits = new Set<string>();
  for (const a of idx.areas) if (hasWholeWords(h, normalise(a.name)) || hasWholeWords(h, normalise(a.official))) hits.add(a.id);
  for (const al of idx.aliases) { const id = unambiguousAreaOf(al); if (id && hasWholeWords(h, normalise(al.alias))) hits.add(id); }
  return hits.size === 1 ? idx.byId.get([...hits][0])! : null;
}

/** The area a chosen venue sits in: a past event's stored locality first (an explicit area), otherwise the address. */
export function areaFromVenue(idx: AreaIndex, v: Pick<VenueOption, "locality" | "address">): Area | null {
  return areaFromLocality(idx, v.locality) ?? areaFromAddress(idx, v.address);
}

// ── the auto-select / override rule ────────────────────────────────────────────────────────────────────────────────────────────────────

export type AreaSource = "none" | "venue" | "manual";
export type AreaChoice = { areaId: string | null; source: AreaSource; legacyText: boolean };
export type VenuePickOutcome =
  | { kind: "set"; areaId: string }            // area filled from the venue; show "chosen from the venue" hint
  | { kind: "keep" }                           // nothing derived, or the same area: change nothing
  | { kind: "conflict"; areaId: string };      // the member already chose something else: keep it, offer the venue's area

/**
 * Picking a known venue:
 *  - no area yet, or the area came from an earlier venue pick: fill it from this venue (when one can be derived).
 *  - the member chose the area themselves (or has older typed text we must not lose): NEVER overwrite; if the venue implies a different area, say so and offer it.
 */
export function onVenuePicked(cur: AreaChoice, derivedAreaId: string | null): VenuePickOutcome {
  if (!derivedAreaId) return { kind: "keep" };
  if (cur.areaId === derivedAreaId && !cur.legacyText) return { kind: "keep" };
  const memberOwned = cur.source === "manual" || cur.legacyText;
  if (memberOwned && (cur.areaId || cur.legacyText)) return { kind: "conflict", areaId: derivedAreaId };
  return { kind: "set", areaId: derivedAreaId };
}

// ── venues ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const SEP = /\s+[-–—]\s+|,|\(/;
/** "Mareel" and "Mareel - Music - Cinema and Education Venue" are the same place: one name is the other plus a separated description. */
function sameVenueName(a: string, b: string): boolean {
  const na = normalise(a), nb = normalise(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const [short, long, longRaw] = na.length <= nb.length ? [na, nb, b] : [nb, na, a];
  return long.startsWith(short + " ") && SEP.test(longRaw) && normalise(longRaw.split(SEP)[0]) === short;
}

/** Two same-named records are one place unless their known locations clearly differ ("Hall" in Brae is not "Hall" in Voe). */
function sameWhere(a: VenueOption, b: VenueOption): boolean {
  const la = normalise(a.locality ?? ""), lb = normalise(b.locality ?? "");
  if (la && lb) return la === lb;
  const loc = la || lb, addr = normalise((la ? b.address : a.address) ?? "");
  return !loc || !addr || hasWholeWords(addr, loc);
}

function pickBetter(a: VenueOption, b: VenueOption): VenueOption {
  const first = a.source === "business" ? a : b.source === "business" ? b : a.name.length <= b.name.length ? a : b;
  const other = first === a ? b : a;
  return {
    ...first,
    name: first.source === "business" ? first.name : (a.name.length <= b.name.length ? a.name : b.name),
    address: first.address ?? other.address, locality: first.locality ?? other.locality,
    lat: first.lat ?? other.lat, lng: first.lng ?? other.lng,
    context: first.context || other.context,
  };
}

/** Merge near-duplicates (businesses win; otherwise the shortest name); keeps the first-seen order of the surviving entries. */
export function dedupeVenues(list: VenueOption[]): VenueOption[] {
  const out: VenueOption[] = [];
  for (const v of list) {
    const i = out.findIndex((o) => sameVenueName(o.name, v.name) && sameWhere(o, v));
    if (i < 0) out.push(v); else out[i] = pickBetter(out[i], v);
  }
  return out;
}

/** Rank by how well the name matches the typed text; a business beats a past-event record when equal. */
export function rankVenues(list: VenueOption[], query: string, limit = 8): VenueOption[] {
  const q = normalise(query);
  if (q.length < 2) return [];
  const score = (v: VenueOption) => {
    const n = normalise(v.name);
    const base = n === q ? 0 : n.startsWith(q) ? 1 : n.split(" ").some((w) => w.startsWith(q)) ? 2 : n.includes(q) ? 3 : normalise(`${v.address ?? ""} ${v.locality ?? ""}`).includes(q) ? 5 : 9;
    return base + (v.source === "business" ? 0 : 0.5);
  };
  return list.map((v) => ({ v, s: score(v) })).filter((x) => x.s < 9).sort((a, b) => a.s - b.s || a.v.name.length - b.v.name.length || a.v.name.localeCompare(b.v.name, "en-GB")).slice(0, limit).map((x) => x.v);
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
/** Coordinates only count as a pair, inside a sane Shetland-ish box is NOT assumed: just finite and on Earth. */
function coords(lat: unknown, lng: unknown): { lat: number | null; lng: number | null } {
  const a = num(lat), b = num(lng);
  return a !== null && b !== null && Math.abs(a) <= 90 && Math.abs(b) <= 180 && !(a === 0 && b === 0) ? { lat: a, lng: b } : { lat: null, lng: null };
}

export function shapeBusinesses(rows: unknown): VenueOption[] {
  if (!Array.isArray(rows)) return [];
  return (rows as Record<string, unknown>[]).flatMap((r) => {
    const name = str(r.name), id = str(r.id);
    if (!name || !id) return [];
    const address = str(r.address), c = coords(r.lat, r.lng);
    return [{ key: `b:${id}`, name, source: "business" as const, context: address ?? "", address, locality: null, ...c }];
  });
}

export function shapeEventVenues(rows: unknown): VenueOption[] {
  if (!Array.isArray(rows)) return [];
  const m = new Map<string, { v: VenueOption; n: number }>();
  for (const r of rows as Record<string, unknown>[]) {
    const name = str(r.venue);
    if (!name) continue;
    const loc = str(r.locality), c = coords(r.lat, r.lng), k = normalise(name) + "|" + normalise(loc ?? "");
    const prev = m.get(k);
    if (prev) { prev.n++; if (prev.v.lat === null && c.lat !== null) { prev.v.lat = c.lat; prev.v.lng = c.lng; } }
    else m.set(k, { v: { key: `h:${k}`, name, source: "history", context: loc ?? "", address: null, locality: loc, ...c }, n: 1 });
  }
  return [...m.values()].sort((a, b) => b.n - a.n).map((x) => x.v);
}

// ── loaders (silent on failure: callers get an empty result and the form stays a plain text box) ──────────────────────────────────────

export async function loadAreaIndex(sb: LocationClient): Promise<AreaIndex | null> {
  try {
    const a = await sb.from("areas").select("id, name_display, name_official, type, parent_id, sort_order").eq("is_active", true).eq("is_physical", true).order("sort_order", { ascending: true });
    if (a.error || !Array.isArray(a.data)) return null;
    const areas = shapeAreas(a.data);
    if (!areas.length) return null;
    let aliases: Alias[] = [];
    try {
      const al = await sb.from("place_aliases").select("alias, area_id, candidate_ids, kind").eq("is_active", true);
      if (!al.error) aliases = shapeAliases(al.data);
    } catch { /* aliases are a bonus */ }
    return buildAreaIndex(areas, aliases);
  } catch { return null; }
}

export async function loadBusinessVenues(sb: LocationClient, query: string, limit = 12): Promise<VenueOption[]> {
  const q = likeTerm(query);
  if (q.length < 2) return [];
  try {
    const r = await sb.from("local_businesses").select("id, name, address, lat, lng").eq("is_active", true).ilike("name", `%${q}%`).order("name", { ascending: true }).limit(limit);
    return r.error ? [] : shapeBusinesses(r.data);
  } catch { return []; }
}

export async function loadEventVenues(sb: LocationClient): Promise<VenueOption[]> {
  try {
    const r = await sb.from("events").select("venue, locality, lat, lng").eq("status", "published").eq("is_hidden", false).not("venue", "is", null).order("starts_at", { ascending: false }).limit(400);
    return r.error ? [] : shapeEventVenues(r.data);
  } catch { return []; }
}

/** The combined, de-duplicated, ranked suggestions for what has been typed. */
export function suggestVenues(history: VenueOption[], businesses: VenueOption[], query: string, limit = 8): VenueOption[] {
  return rankVenues(dedupeVenues([...businesses, ...history]), query, limit);
}
