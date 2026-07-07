/**
 * boats-data.ts — Da Boats (Shetland fishing-fleet registry) for web.
 * Mirrors the app's lib/boats-api.ts. Public reads via publicClient();
 * auth-scoped reads in boats-data.server.ts; writes in client components.
 */

import { publicClient } from "@/lib/supabase/public";

export const BOATS = "#1e3a8a";

const safe = async <T>(p: PromiseLike<T>, f: T): Promise<T> => { try { return await p; } catch { return f; } };

/* ── Types ───────────────────────────────────────────────────────────────── */

export type Confidence = "confirmed" | "probable" | "possible" | "unmatched" | "conflict";
export type EditAction = "edit" | "add" | "remove";
export type EditTable = "vessels" | "vessel_names" | "registrations" | "ownership_periods" | "owners" | "measurements";

export interface Vessel {
  id: string; vessel_key: string; canonical_name: string; primary_lk_number: string | null;
  built_year: number | null; builder: string | null; yard_number: string | null;
  hull_material: string | null; country_of_build: string | null; status: string | null;
  identity_confidence: Confidence | null; identity_notes: string | null; comment_count: number | null;
}
export interface VesselSearchRow {
  id: string; canonical_name: string; primary_lk_number: string | null; built_year: number | null;
  builder: string | null; hull_material: string | null; status: string | null;
  identity_confidence: Confidence | null; all_names: string | null; all_registrations: string | null;
  media_asset_count: number | null;
}
export interface VesselName { id: string; vessel_id: string; name: string; normalised_name: string | null; start_year: number | null; end_year: number | null; date_text: string | null; is_primary: boolean; confidence: Confidence | null; }
export interface Registration { id: string; vessel_id: string; registration: string; start_year: number | null; end_year: number | null; date_text: string | null; is_primary: boolean; confidence: Confidence | null; }
export interface Owner { id: string; name: string; notes: string | null; }
export interface OwnershipPeriod { id: string; vessel_id: string; owner_id: string; owner?: Owner | null; start_year: number | null; end_year: number | null; date_text: string | null; confidence: Confidence | null; notes: string | null; }
export interface Measurement { id: string; vessel_id: string; measurement_year: number | null; length_m: number | null; tonnage: number | null; tonnage_text: string | null; engine_power_kw: number | null; notes: string | null; }
export interface VesselEvent { id: string; vessel_id: string; event_type: string; event_year: number | null; event_date_text: string | null; description: string | null; location: string | null; confidence: Confidence | null; }
export interface MediaAsset { id: string; asset_type: string | null; title: string | null; image_url: string | null; thumbnail_url: string | null; page_url: string | null; rights_note: string | null; external_ref: string | null; }
export interface VesselComment {
  id: string; vessel_id: string; author_id: string; subject_type: string; subject_row_id: string | null;
  parent_comment_id: string | null; body: string; image_url: string | null; image_path: string | null;
  is_hidden: boolean; edited_at: string | null; created_at: string;
  author?: { id: string; full_name: string | null; display_name: string | null; avatar_url: string | null } | null;
  replies?: VesselComment[];
}
export interface VesselEditProposal {
  id: string; vessel_id: string; target_table: EditTable; target_row_id: string | null; target_column: string | null;
  action: EditAction; payload: Record<string, unknown>; current_value: string | null; summary: string; note: string | null;
  proposed_by: string; status: "open" | "applied" | "rejected" | "superseded"; confirm_count: number; dispute_count: number; created_at: string;
}
export interface VesselProfile {
  vessel: Vessel; names: VesselName[]; registrations: Registration[]; ownerships: OwnershipPeriod[];
  measurements: Measurement[]; events: VesselEvent[]; media: MediaAsset[];
}

/* ── Labels / helpers ────────────────────────────────────────────────────── */

const HULL: Record<string, string> = { F: "Fibreglass", S: "Steel", W: "Wood", A: "Aluminium", U: "Unknown", O: "Other" };
export function hullMaterialLabel(code: string | null): string | null { return code ? HULL[code] ?? code : null; }

const CONF: Record<Confidence, string> = { confirmed: "Confirmed", probable: "Almost certain", possible: "Likely", unmatched: "Not yet matched", conflict: "Sources disagree" };
export function confidenceLabel(c: Confidence | null): string { return c ? CONF[c] ?? c : "—"; }
export function confidenceTone(c: Confidence | null): "green" | "blue" | "amber" | "gray" | "red" {
  return c === "confirmed" ? "green" : c === "probable" ? "blue" : c === "possible" ? "amber" : c === "conflict" ? "red" : "gray";
}

const EVENT_LABEL: Record<string, string> = {
  built: "Built", rename: "Renamed", sale: "Sold", loss: "Lost", scrapped: "Scrapped", note: "Note",
  photo: "Photograph", registration: "Registration", name: "Name", community_edit: "Community edit", official_snapshot_seen: "Recorded in registry",
};
export function eventTypeLabel(t: string): string { return EVENT_LABEL[t] ?? t.replace(/_/g, " "); }

export const COMMENT_SUBJECTS: { slug: string; label: string }[] = [
  { slug: "general", label: "General" }, { slug: "names", label: "Names" }, { slug: "registrations", label: "Numbers" },
  { slug: "owners", label: "Owners" }, { slug: "photos", label: "Photos" }, { slug: "build", label: "Build" },
  { slug: "story", label: "Story" }, { slug: "correction", label: "Correction" }, { slug: "addition", label: "Addition" },
];
export function commentSubjectLabel(slug: string): string { return COMMENT_SUBJECTS.find((s) => s.slug === slug)?.label ?? slug; }

export function vesselDisplayTitle(v: { primary_lk_number: string | null; canonical_name: string }): string {
  return v.primary_lk_number ? `${v.primary_lk_number} ${v.canonical_name}` : v.canonical_name;
}

export function buildEditSummary(a: { action: EditAction; label: string; value?: string; currentValue?: string | null }): string {
  if (a.action === "remove") return `Remove ${a.label.toLowerCase()}${a.currentValue ? `: “${a.currentValue}”` : ""}`;
  if (a.action === "add") return `Add ${a.label.toLowerCase()}: “${a.value ?? ""}”`;
  return `Change ${a.label.toLowerCase()} to “${a.value ?? ""}”`;
}

/** Group duplicate rows; return [{ rep, others }] keeping the highest-ranked as rep. */
export function dedupeRows<T>(items: T[], keyOf: (x: T) => string, rankOf: (x: T) => number): { rep: T; others: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const it of items) { const k = keyOf(it); (groups.get(k) ?? groups.set(k, []).get(k)!).push(it); }
  return [...groups.values()].map((g) => { const sorted = g.slice().sort((a, b) => rankOf(b) - rankOf(a)); return { rep: sorted[0], others: sorted.slice(1) }; });
}
const CONF_RANK: Record<string, number> = { confirmed: 5, probable: 4, possible: 3, unmatched: 2, conflict: 1 };
export const confRankOf = (c: Confidence | null, primary?: boolean) => (CONF_RANK[c ?? ""] ?? 0) * 100 + (primary ? 10 : 0);

/* ── Reads ───────────────────────────────────────────────────────────────── */

export async function searchVessels(query: string, limit = 120): Promise<VesselSearchRow[]> {
  const sb = publicClient();
  return safe((async () => {
    let q = sb.from("vessel_search").select("id, canonical_name, primary_lk_number, built_year, builder, hull_material, status, identity_confidence, all_names, all_registrations, media_asset_count").limit(limit);
    const k = query.replace(/[%,]/g, "").trim();
    if (k) q = q.or(`canonical_name.ilike.%${k}%,all_names.ilike.%${k}%,all_registrations.ilike.%${k}%,primary_lk_number.ilike.%${k}%`);
    q = q.order("built_year", { ascending: false, nullsFirst: false });
    const { data } = await q;
    return (data ?? []) as VesselSearchRow[];
  })(), []);
}

export async function fetchHeroPhotos(ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {};
  const sb = publicClient();
  return safe((async () => {
    const { data } = await sb.from("vessel_media_links").select("vessel_id, media:media_assets(image_url, thumbnail_url, asset_type)").in("vessel_id", ids);
    const out: Record<string, string> = {};
    for (const r of (data ?? []) as unknown as { vessel_id: string; media: { image_url: string | null; thumbnail_url: string | null } | null }[]) {
      const url = r.media?.thumbnail_url || r.media?.image_url;
      if (url && !out[r.vessel_id]) out[r.vessel_id] = url;
    }
    return out;
  })(), {});
}

export async function fetchVesselProfile(id: string): Promise<VesselProfile | null> {
  const sb = publicClient();
  return safe((async () => {
    const { data: vessel } = await sb.from("vessels").select("*").eq("id", id).maybeSingle();
    if (!vessel) return null;
    const [names, regs, owns, meas, events, media] = await Promise.all([
      sb.from("vessel_names").select("*").eq("vessel_id", id).order("is_primary", { ascending: false }),
      sb.from("registrations").select("*").eq("vessel_id", id).order("is_primary", { ascending: false }),
      sb.from("ownership_periods").select("*, owner:owners(id, name, notes)").eq("vessel_id", id).order("start_year", { ascending: true, nullsFirst: false }),
      sb.from("measurements").select("*").eq("vessel_id", id).order("measurement_year", { ascending: false, nullsFirst: false }),
      sb.from("vessel_events").select("*").eq("vessel_id", id),
      sb.from("vessel_media_links").select("media:media_assets(*)").eq("vessel_id", id),
    ]);
    return {
      vessel: vessel as Vessel,
      names: (names.data ?? []) as VesselName[],
      registrations: (regs.data ?? []) as Registration[],
      ownerships: (owns.data ?? []) as OwnershipPeriod[],
      measurements: (meas.data ?? []) as Measurement[],
      events: (events.data ?? []) as VesselEvent[],
      media: ((media.data ?? []) as unknown as { media: MediaAsset | null }[]).map((m) => m.media).filter(Boolean) as MediaAsset[],
    };
  })(), null);
}

export interface TimelineEntry { year: number | null; date_text: string | null; item_type: string; description: string | null; confidence: Confidence | null; }
export async function fetchVesselTimeline(id: string): Promise<TimelineEntry[]> {
  const sb = publicClient();
  return safe((async () => {
    const { data } = await sb.from("vessel_timeline").select("year, date_text, item_type, description, confidence").eq("vessel_id", id).order("year", { ascending: true, nullsFirst: false });
    return (data ?? []) as TimelineEntry[];
  })(), []);
}

export async function fetchVesselComments(id: string): Promise<VesselComment[]> {
  const sb = publicClient();
  return safe((async () => {
    const { data } = await sb.from("vessel_comments")
      .select("*, author:profiles(id, full_name, display_name, avatar_url)")
      .eq("vessel_id", id).eq("is_hidden", false).order("created_at", { ascending: true });
    return (data ?? []) as VesselComment[];
  })(), []);
}

/** Thread flat comments into top-level + one level of replies. */
export function threadComments(flat: VesselComment[]): VesselComment[] {
  const top = flat.filter((c) => !c.parent_comment_id).map((c) => ({ ...c, replies: [] as VesselComment[] }));
  const byId = new Map(top.map((c) => [c.id, c]));
  for (const c of flat) if (c.parent_comment_id) { const parent = byId.get(c.parent_comment_id); if (parent) parent.replies!.push(c); else top.push({ ...c, replies: [] }); }
  return top;
}

export async function fetchVesselEdits(id: string): Promise<VesselEditProposal[]> {
  const sb = publicClient();
  return safe((async () => {
    const { data } = await sb.from("vessel_edit_proposals").select("*").eq("vessel_id", id).in("status", ["open", "applied"]).order("created_at", { ascending: false });
    return (data ?? []) as VesselEditProposal[];
  })(), []);
}

/* ── Build-place gazetteer ───────────────────────────────────────────────── */
// Mirrors the app's lib/boats-stats.ts. Builder strings in the archive embed
// the yard's town ("…in Buckie", "Macduff Shipyards", "in Skagen"); we match
// those to coordinates so the landing can plot where the fleet was built.

export interface BuildPlace { key: string; label: string; lat: number; lng: number; aliases: string[]; }

const BUILD_PLACES: BuildPlace[] = [
  // North-East Scotland
  { key: "buckie", label: "Buckie", lat: 57.676, lng: -2.965, aliases: ["buckie", "jones buckie", "herd & mackenzie", "herd and mackenzie"] },
  { key: "macduff", label: "Macduff", lat: 57.671, lng: -2.497, aliases: ["macduff"] },
  { key: "fraserburgh", label: "Fraserburgh", lat: 57.693, lng: -2.005, aliases: ["fraserburgh"] },
  { key: "sandhaven", label: "Sandhaven", lat: 57.700, lng: -2.040, aliases: ["sandhaven", "forbes"] },
  { key: "peterhead", label: "Peterhead", lat: 57.508, lng: -1.784, aliases: ["peterhead"] },
  { key: "aberdeen", label: "Aberdeen", lat: 57.149, lng: -2.094, aliases: ["aberdeen", "hall russell"] },
  { key: "banff", label: "Banff", lat: 57.665, lng: -2.529, aliases: ["banff"] },
  { key: "whitehills", label: "Whitehills", lat: 57.679, lng: -2.581, aliases: ["whitehills"] },
  // East / Fife / Borders
  { key: "stmonans", label: "St Monans", lat: 56.206, lng: -2.766, aliases: ["st monans", "st. monans", "miller"] },
  { key: "anstruther", label: "Anstruther", lat: 56.221, lng: -2.699, aliases: ["anstruther"] },
  { key: "arbroath", label: "Arbroath", lat: 56.561, lng: -2.583, aliases: ["arbroath"] },
  { key: "eyemouth", label: "Eyemouth", lat: 55.872, lng: -2.090, aliases: ["eyemouth", "coastal marine"] },
  // West coast
  { key: "campbeltown", label: "Campbeltown", lat: 55.425, lng: -5.606, aliases: ["campbeltown"] },
  { key: "girvan", label: "Girvan", lat: 55.245, lng: -4.857, aliases: ["girvan", "noble"] },
  // England / Wales
  { key: "whitby", label: "Whitby", lat: 54.486, lng: -0.613, aliases: ["whitby", "parkol"] },
  { key: "penryn", label: "Penryn", lat: 50.169, lng: -5.107, aliases: ["penryn", "cygnus"] },
  { key: "appledore", label: "Appledore", lat: 51.057, lng: -4.193, aliases: ["appledore", "bideford"] },
  // Shetland & Orkney (home-built)
  { key: "lerwick", label: "Lerwick", lat: 60.155, lng: -1.145, aliases: ["lerwick", "hay & co", "malakoff"] },
  { key: "scalloway", label: "Scalloway", lat: 60.133, lng: -1.276, aliases: ["scalloway"] },
  // Nordic & beyond
  { key: "skagen", label: "Skagen (DK)", lat: 57.721, lng: 10.583, aliases: ["skagen", "karstensen"] },
  { key: "flekkefjord", label: "Flekkefjord (NO)", lat: 58.297, lng: 6.661, aliases: ["flekkefjord"] },
  { key: "maloy", label: "Måløy (NO)", lat: 61.936, lng: 5.113, aliases: ["måløy", "maloy", "solund"] },
  { key: "simek", label: "Flekkefjord (NO)", lat: 58.297, lng: 6.661, aliases: ["simek"] },
  { key: "istanbul", label: "Istanbul (TR)", lat: 41.008, lng: 28.978, aliases: ["istanbul", "sedef", "tersan"] },
  { key: "gdansk", label: "Gdańsk (PL)", lat: 54.352, lng: 18.646, aliases: ["gdansk", "gdańsk", "poland"] },
  { key: "iceland", label: "Iceland", lat: 64.146, lng: -21.94, aliases: ["reykjav", "iceland", "akureyri"] },
];

export function matchBuildPlace(builder: string | null): BuildPlace | null {
  if (!builder) return null;
  const b = builder.toLowerCase();
  for (const p of BUILD_PLACES) if (p.aliases.some((a) => b.includes(a))) return p;
  return null;
}

/* ── Fleet stats (landing) ───────────────────────────────────────────────── */

export interface BuildPlaceCount extends BuildPlace { count: number; }
export interface FleetStats {
  total: number; withPhotos: number; yearMin: number | null; yearMax: number | null; builderCount: number;
  decades: { label: string; count: number }[]; hulls: { label: string; count: number }[];
  topBuilders: { name: string; count: number }[];
  buildPlaces: BuildPlaceCount[]; placedBoats: number;
}
export function cleanBuilderName(name: string): string {
  return name.replace(/,.*$/, "").replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();
}
export function computeFleetStats(rows: VesselSearchRow[]): FleetStats {
  const decades = new Map<string, number>(); const hulls = new Map<string, number>(); const builders = new Map<string, number>();
  const places = new Map<string, BuildPlaceCount>();
  let withPhotos = 0; let yearMin: number | null = null; let yearMax: number | null = null; let placedBoats = 0;
  for (const r of rows) {
    if ((r.media_asset_count ?? 0) > 0) withPhotos++;
    if (r.built_year) { const d = `${Math.floor(r.built_year / 10) * 10}s`; decades.set(d, (decades.get(d) ?? 0) + 1); yearMin = yearMin === null ? r.built_year : Math.min(yearMin, r.built_year); yearMax = yearMax === null ? r.built_year : Math.max(yearMax, r.built_year); }
    const hl = hullMaterialLabel(r.hull_material); if (hl) hulls.set(hl, (hulls.get(hl) ?? 0) + 1);
    if (r.builder) { const b = cleanBuilderName(r.builder); if (b) builders.set(b, (builders.get(b) ?? 0) + 1); }
    const place = matchBuildPlace(r.builder);
    if (place) { placedBoats++; const ex = places.get(place.key); if (ex) ex.count++; else places.set(place.key, { ...place, count: 1 }); }
  }
  return {
    total: rows.length, withPhotos, yearMin, yearMax, builderCount: builders.size,
    decades: [...decades.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => a.label.localeCompare(b.label)),
    hulls: [...hulls.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
    topBuilders: [...builders.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10),
    buildPlaces: [...places.values()].sort((a, b) => b.count - a.count),
    placedBoats,
  };
}

/* ── Saved / recently-viewed (localStorage) ──────────────────────────────── */
// Mirrors the app's lib/boats-prefs.ts (AsyncStorage). Lightweight stubs so the
// landing can render Saved + Recent rows instantly without a fetch.

export interface VesselStub { id: string; lk_number: string | null; canonical_name: string; built_year: number | null; hero_url: string | null; last_seen?: string; }

const SAVED_KEY = "daBoats.saved.v1";
const RECENT_KEY = "daBoats.recent.v1";
const MAX_RECENT = 8;

function readStubs(key: string): VesselStub[] {
  if (typeof window === "undefined") return [];
  try { const raw = window.localStorage.getItem(key); if (!raw) return []; const arr = JSON.parse(raw); return Array.isArray(arr) ? arr : []; } catch { return []; }
}
function writeStubs(key: string, list: VesselStub[]): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(key, JSON.stringify(list)); } catch { /* non-fatal */ }
}

export function loadSavedBoats(): VesselStub[] { return readStubs(SAVED_KEY); }
export function isBoatSaved(id: string): boolean { return loadSavedBoats().some((b) => b.id === id); }
/** Toggle saved. Returns the new saved-state. */
export function toggleSavedBoat(stub: VesselStub): boolean {
  const list = loadSavedBoats();
  const had = list.some((b) => b.id === stub.id);
  writeStubs(SAVED_KEY, had ? list.filter((b) => b.id !== stub.id) : [{ ...stub, last_seen: new Date().toISOString() }, ...list]);
  return !had;
}

export function loadRecentBoats(): VesselStub[] { return readStubs(RECENT_KEY); }
export function pushRecentBoat(stub: VesselStub): VesselStub[] {
  const filtered = loadRecentBoats().filter((b) => b.id !== stub.id);
  const next = [{ ...stub, last_seen: new Date().toISOString() }, ...filtered].slice(0, MAX_RECENT);
  writeStubs(RECENT_KEY, next);
  return next;
}
export function clearRecentBoats(): void { writeStubs(RECENT_KEY, []); }
