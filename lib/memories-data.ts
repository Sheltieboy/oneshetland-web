/**
 * memories-data.ts — Memories (a living map of the islands) for web.
 * Mirrors the app's lib/memories-api.ts. Public reads via publicClient();
 * writes (create, media upload, react, comment, transcription) in client components.
 */

import { publicClient } from "@/lib/supabase/public";

export const MEMORIES = "#9f1239";
const safe = async <T>(p: PromiseLike<T>, f: T): Promise<T> => { try { return await p; } catch { return f; } };

/* ── Types ───────────────────────────────────────────────────────────────── */

export type MediaKind = "photo" | "video" | "audio";
export type ReactionKind = "heart" | "applaud" | "compass" | "scroll";
export type Visibility = "public" | "community" | "private";
export type TranscriptStatus = "none" | "pending" | "done" | "failed";

export interface MemoryAuthor { id: string; full_name: string | null; display_name?: string | null; avatar_url: string | null; }
export interface MemoryMedia {
  id: string; memory_id: string; kind: MediaKind; url: string; storage_path: string | null;
  thumb_url: string | null; transcript: string | null; transcript_status: TranscriptStatus | null;
  caption: string | null; display_order: number | null; duration_seconds: number | null; created_at: string;
}
export interface MemoryComment { id: string; memory_id: string; author_id: string; body: string; created_at: string; author?: MemoryAuthor | null; }
export interface MemoryImagePinSuggestion {
  id: string; pin_id: string; suggester_id: string; answer: string;
  is_accepted: boolean; accepted_at: string | null; created_at: string;
  suggester?: MemoryAuthor | null;
}
export interface MemoryImagePin {
  id: string; media_id: string; author_id: string; x: number; y: number; prompt: string;
  resolved: boolean; resolved_answer: string | null; resolved_by: string | null; resolved_at: string | null;
  accepted_suggestion_id: string | null; created_at: string;
  suggestions?: MemoryImagePinSuggestion[];
}
export interface MemoryPin {
  id: string; lat: number | null; lng: number | null; place_name: string | null; title: string | null;
  era: string | null; tags: string[] | null; media_count: number | null; comment_count: number | null;
  reaction_count: number | null; child_count: number | null; hero_url: string | null; hero_kind: string | null; created_at: string;
}
export interface Memory {
  id: string; author_id: string; lat: number | null; lng: number | null; place_name: string | null; parent_id: string | null;
  era: string | null; tags: string[] | null; title: string | null; body: string | null; visibility: Visibility;
  media_count: number | null; comment_count: number | null; reaction_count: number | null; child_count: number | null; created_at: string;
  author?: MemoryAuthor | null; media?: MemoryMedia[]; comments?: MemoryComment[]; children?: MemoryPin[];
  reactions_by_kind?: Partial<Record<ReactionKind, number>>; pins?: MemoryImagePin[];
}

/* ── Categories / eras ───────────────────────────────────────────────────── */

export const MEMORY_CATEGORIES: { slug: string; label: string; icon: string; color: string }[] = [
  { slug: "fishing", label: "Fishing", icon: "🎣", color: "#1e6f8a" },
  { slug: "crofting", label: "Crofting", icon: "🚜", color: "#6d8a1e" },
  { slug: "textiles", label: "Knitting & textiles", icon: "🧶", color: "#b03a6e" },
  { slug: "boats", label: "Boats & sailing", icon: "⛵", color: "#1e3a8a" },
  { slug: "music", label: "Music & dance", icon: "🎻", color: "#8a5a1e" },
  { slug: "up-helly-aa", label: "Up Helly Aa", icon: "🔥", color: "#E0722A" },
  { slug: "spik", label: "Spik & dialect", icon: "💬", color: "#12B3D6" },
  { slug: "folklore", label: "Folklore", icon: "🧙", color: "#6b47bf" },
  { slug: "family", label: "Family", icon: "👪", color: "#9f1239" },
  { slug: "school", label: "School days", icon: "🎓", color: "#3a4754" },
  { slug: "wartime", label: "Wartime", icon: "🪖", color: "#475569" },
  { slug: "wildlife", label: "Wildlife", icon: "🐦", color: "#2a8b5c" },
  { slug: "faith", label: "Faith & kirk", icon: "⛪", color: "#7c3aed" },
  { slug: "trade", label: "Trade & shops", icon: "🏪", color: "#b8860b" },
];
export const CATEGORY_BY_SLUG = Object.fromEntries(MEMORY_CATEGORIES.map((c) => [c.slug, c]));
export const ERA_SUGGESTIONS = ["Pre-1900", "Pre-war", "1920s", "1930s", "WWII", "1950s", "1960s", "1970s", "1980s", "1990s", "2000s", "Recent"];
export const REACTIONS: { kind: ReactionKind; icon: string; label: string }[] = [
  { kind: "heart", icon: "❤️", label: "Love it" }, { kind: "applaud", icon: "👏", label: "Bravo" },
  { kind: "compass", icon: "🧭", label: "Helpful" }, { kind: "scroll", icon: "📜", label: "Heritage" },
];

/* ── Media URLs ──────────────────────────────────────────────────────────── */

/**
 * memories-media is a PRIVATE bucket, so a memory's photos and audio are not
 * served from a guessable /object/public/ URL. They are signed for at read time
 * instead, and the signing itself is authorised by storage RLS:
 *
 *   viewer's session → can_view_memory() → public.memories RLS → signed URL
 *
 * That means a public memory signs for anyone (including anonymous visitors,
 * which is why this works with the anon-key publicClient), and a community or
 * private one only signs for someone the memories policy already lets read the
 * row. There is no second definition of "private" here — the database decides.
 *
 * TTL is one hour. Long enough that a page render and its images comfortably
 * share one URL, short enough that changing a memory to private takes effect
 * within the hour for URLs already handed out. Do not raise it for caching:
 * an hour IS the revocation delay.
 */
const MEDIA_TTL_SECONDS = 3600;

async function signPaths(
  sb: ReturnType<typeof publicClient>,
  paths: string[],
): Promise<Record<string, string>> {
  const wanted = [...new Set(paths.filter(Boolean))];
  if (!wanted.length) return {};
  const { data } = await sb.storage.from("memories-media").createSignedUrls(wanted, MEDIA_TTL_SECONDS);
  const out: Record<string, string> = {};
  for (const r of data ?? []) {
    // createSignedUrls reports per-path failures rather than throwing: a path
    // the viewer may not see comes back with an error and no signedUrl, which
    // is exactly the outcome we want — it simply does not appear in the map.
    if (r.path && r.signedUrl) out[r.path] = r.signedUrl;
  }
  return out;
}

/* ── Hero helper ─────────────────────────────────────────────────────────── */

async function attachHeroes(pins: MemoryPin[]): Promise<MemoryPin[]> {
  if (!pins.length) return pins;
  const sb = publicClient();

  // Signs for EVERY pin, not only the ones missing a hero.
  //
  // fetch_memory_pins used to return hero_url straight from memory_media.url —
  // the legacy public URL. An earlier version of this function treated that as
  // "already done" and skipped signing, so the list page kept rendering
  // /object/public/ links while the detail page rendered signed ones, and those
  // links died the moment the bucket became private. Migration 20260821270000
  // has since stopped the RPC serving that column at all: it returns hero_path
  // and a null hero_url. Signing every pin here is what fills it, and it also
  // covers the two fallback paths below, which read the memories table directly
  // and never had a hero of their own.
  const { data } = await sb.from("memory_media")
    .select("memory_id, kind, url, thumb_url, storage_path")
    .in("memory_id", pins.map((p) => p.id))
    .order("display_order", { ascending: true });
  const rows = (data ?? []) as { memory_id: string; kind: string; url: string; thumb_url: string | null; storage_path: string | null }[];
  const signed = await signPaths(sb, rows.map((m) => m.storage_path ?? ""));

  const map: Record<string, { url: string; kind: string }> = {};
  for (const m of rows) {
    if (map[m.memory_id]) continue;
    if (m.kind !== "photo" && m.kind !== "video") continue;
    // A signed URL if we could get one; the legacy fields only as a last
    // resort, for a row that has no storage_path at all.
    const url = (m.storage_path && signed[m.storage_path]) || m.thumb_url || m.url;
    if (url) map[m.memory_id] = { url, kind: m.kind };
  }
  return pins.map((p) => map[p.id] ? { ...p, hero_url: map[p.id].url, hero_kind: map[p.id].kind } : p);
}

/* ── Reads ───────────────────────────────────────────────────────────────── */

const SHETLAND_BBOX = { min_lat: 59.4, max_lat: 61.0, min_lng: -2.4, max_lng: -0.4 };

export async function getMemoryPins(limit = 500): Promise<MemoryPin[]> {
  const sb = publicClient();
  return safe((async () => {
    const { data, error } = await sb.rpc("fetch_memory_pins", { ...SHETLAND_BBOX, result_limit: limit });
    if (!error && data) return attachHeroes(data as MemoryPin[]);
    // Fallback: direct table read
    const { data: rows } = await sb.from("memories")
      .select("id, lat, lng, place_name, title, era, tags, media_count, comment_count, reaction_count, child_count, created_at")
      .is("parent_id", null).eq("visibility", "public").eq("is_hidden", false)
      .not("lat", "is", null).order("created_at", { ascending: false }).limit(limit);
    return attachHeroes((rows ?? []) as MemoryPin[]);
  })(), []);
}

export async function getRecentMemories(limit = 12): Promise<MemoryPin[]> {
  const sb = publicClient();
  return safe((async () => {
    const { data } = await sb.from("memories")
      .select("id, lat, lng, place_name, title, era, tags, media_count, comment_count, reaction_count, child_count, created_at")
      .is("parent_id", null).eq("visibility", "public").eq("is_hidden", false)
      .order("created_at", { ascending: false }).limit(limit);
    return attachHeroes((data ?? []) as MemoryPin[]);
  })(), []);
}

export async function searchMemories(query: string, limit = 40): Promise<MemoryPin[]> {
  const k = query.trim();
  if (!k) return getRecentMemories(limit);
  const sb = publicClient();
  return safe((async () => {
    const { data, error } = await sb.rpc("search_memories", { q: k, result_limit: limit });
    if (!error && data) return attachHeroes((data as { id: string; title: string | null; place_name: string | null; era: string | null; tags: string[] | null; created_at: string; hero_url: string | null; hero_kind: string | null }[]).map((r) => ({ ...r, lat: null, lng: null, media_count: null, comment_count: null, reaction_count: null, child_count: null })) as MemoryPin[]);
    const { data: rows } = await sb.from("memories")
      .select("id, lat, lng, place_name, title, era, tags, media_count, comment_count, reaction_count, child_count, created_at")
      .is("parent_id", null).eq("visibility", "public").eq("is_hidden", false)
      .or(`title.ilike.%${k}%,body.ilike.%${k}%,era.ilike.%${k}%,place_name.ilike.%${k}%`)
      .order("created_at", { ascending: false }).limit(limit);
    return attachHeroes((rows ?? []) as MemoryPin[]);
  })(), []);
}

export async function getMemoryDetail(id: string): Promise<Memory | null> {
  const sb = publicClient();
  return safe((async () => {
    const { data: memory } = await sb.from("memories").select("*").eq("id", id).maybeSingle();
    if (!memory) return null;
    const [media, comments, children, reactions] = await Promise.all([
      safe(sb.from("memory_media").select("*").eq("memory_id", id).order("display_order", { ascending: true }).then((r) => r.data ?? []), [] as unknown[]),
      safe(sb.from("memory_comments").select("id, memory_id, author_id, body, created_at").eq("memory_id", id).eq("is_hidden", false).order("created_at", { ascending: true }).then((r) => r.data ?? []), [] as unknown[]),
      safe(sb.from("memories").select("id, title, place_name, era, tags, media_count, comment_count, reaction_count, child_count, lat, lng, created_at").eq("parent_id", id).eq("is_hidden", false).order("created_at", { ascending: true }).then((r) => r.data ?? []), [] as unknown[]),
      safe(sb.from("memory_reactions").select("kind").eq("memory_id", id).then((r) => r.data ?? []), [] as unknown[]),
    ]);
    // Media is signed for this viewer. A path they may not see simply does not
    // come back signed, so the item renders without a URL rather than leaking.
    const mediaRows = media as MemoryMedia[];
    const signedMedia = await signPaths(sb, mediaRows.map((m) => m.storage_path ?? ""));
    for (const m of mediaRows) {
      if (m.storage_path && signedMedia[m.storage_path]) m.url = signedMedia[m.storage_path];
    }

    // Attach author profiles by id (no embed — robust under RLS)
    const commentRows = comments as MemoryComment[];
    const ids = [...new Set([(memory as Memory).author_id, ...commentRows.map((c) => c.author_id)].filter(Boolean))];
    const { data: profiles } = await sb.from("profiles").select("id, full_name, display_name, avatar_url").in("id", ids);
    const pmap = Object.fromEntries((profiles ?? []).map((p: MemoryAuthor) => [p.id, p]));
    const byKind: Partial<Record<ReactionKind, number>> = {};
    for (const r of reactions as { kind: ReactionKind }[]) byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;
    const childHeroes = await attachHeroes(children as MemoryPin[]);

    // Image pins (annotations) on photos + their community suggestions.
    let pins: MemoryImagePin[] = [];
    const photoIds = (media as MemoryMedia[]).filter((m) => m.kind === "photo").map((m) => m.id);
    if (photoIds.length) {
      const { data: pinData } = await sb.from("memory_image_pins").select("*").in("media_id", photoIds);
      pins = (pinData ?? []) as MemoryImagePin[];
      if (pins.length) {
        const pinIds = pins.map((p) => p.id);
        const { data: sugData } = await sb
          .from("memory_image_pin_suggestions")
          .select("*")
          .in("pin_id", pinIds)
          .order("created_at", { ascending: true });
        const sugRows = (sugData ?? []) as MemoryImagePinSuggestion[];
        // Hydrate suggester profiles (no embed — robust under RLS, mirrors comments).
        const sugIds = [...new Set(sugRows.map((s) => s.suggester_id).filter(Boolean))];
        let smap: Record<string, MemoryAuthor> = {};
        if (sugIds.length) {
          const { data: sp } = await sb.from("profiles").select("id, full_name, display_name, avatar_url").in("id", sugIds);
          smap = Object.fromEntries((sp ?? []).map((p: MemoryAuthor) => [p.id, p]));
        }
        const byPin: Record<string, MemoryImagePinSuggestion[]> = {};
        for (const s of sugRows) (byPin[s.pin_id] ||= []).push({ ...s, suggester: smap[s.suggester_id] ?? null });
        pins = pins.map((p) => ({ ...p, suggestions: byPin[p.id] ?? [] }));
      }
    }

    return {
      ...(memory as Memory),
      author: pmap[(memory as Memory).author_id] ?? null,
      media: media as MemoryMedia[],
      comments: commentRows.map((c) => ({ ...c, author: pmap[c.author_id] ?? null })),
      children: childHeroes,
      reactions_by_kind: byKind,
      pins,
    };
  })(), null);
}

/* ── Display helpers ─────────────────────────────────────────────────────── */

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
export function authorName(a: MemoryAuthor | null | undefined): string {
  return a?.display_name || a?.full_name || "A Shetlander";
}
