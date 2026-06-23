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
  reactions_by_kind?: Partial<Record<ReactionKind, number>>;
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

/* ── Hero helper ─────────────────────────────────────────────────────────── */

async function attachHeroes(pins: MemoryPin[]): Promise<MemoryPin[]> {
  const need = pins.filter((p) => !p.hero_url).map((p) => p.id);
  if (!need.length) return pins;
  const sb = publicClient();
  const { data } = await sb.from("memory_media").select("memory_id, kind, url, thumb_url").in("memory_id", need).order("display_order", { ascending: true });
  const map: Record<string, { url: string; kind: string }> = {};
  for (const m of (data ?? []) as { memory_id: string; kind: string; url: string; thumb_url: string | null }[]) {
    if (!map[m.memory_id] && (m.kind === "photo" || m.kind === "video")) map[m.memory_id] = { url: m.thumb_url || m.url, kind: m.kind };
  }
  return pins.map((p) => p.hero_url ? p : { ...p, hero_url: map[p.id]?.url ?? null, hero_kind: map[p.id]?.kind ?? null });
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
    // Attach author profiles by id (no embed — robust under RLS)
    const commentRows = comments as MemoryComment[];
    const ids = [...new Set([(memory as Memory).author_id, ...commentRows.map((c) => c.author_id)].filter(Boolean))];
    const { data: profiles } = await sb.from("profiles").select("id, full_name, display_name, avatar_url").in("id", ids);
    const pmap = Object.fromEntries((profiles ?? []).map((p: MemoryAuthor) => [p.id, p]));
    const byKind: Partial<Record<ReactionKind, number>> = {};
    for (const r of reactions as { kind: ReactionKind }[]) byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;
    const childHeroes = await attachHeroes(children as MemoryPin[]);
    return {
      ...(memory as Memory),
      author: pmap[(memory as Memory).author_id] ?? null,
      media: media as MemoryMedia[],
      comments: commentRows.map((c) => ({ ...c, author: pmap[c.author_id] ?? null })),
      children: childHeroes,
      reactions_by_kind: byKind,
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
