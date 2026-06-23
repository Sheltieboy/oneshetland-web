"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MemoryMap } from "@/components/memories/MemoryMap";
import { VoiceRecorder } from "@/components/memories/VoiceRecorder";
import { MEMORY_CATEGORIES, ERA_SUGGESTIONS, MEMORIES, type Visibility, type MediaKind } from "@/lib/memories-data";

type Draft = { kind: MediaKind; file: Blob; name: string; durationSec?: number; preview: string };
export type EditableMemory = {
  id: string; title: string | null; body: string | null; place_name: string | null;
  era: string | null; tags: string[] | null; visibility: Visibility; lat: number | null; lng: number | null;
};

export function MemoryComposer({ isLoggedIn, parentId, existing }: { isLoggedIn: boolean; parentId?: string; existing?: EditableMemory }) {
  const router = useRouter();
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(existing && existing.lat != null && existing.lng != null ? { lat: existing.lat, lng: existing.lng } : null);
  const [placeName, setPlaceName] = useState(existing?.place_name ?? "");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [era, setEra] = useState(existing?.era ?? "");
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const [visibility, setVisibility] = useState<Visibility>(existing?.visibility ?? "public");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const [Voice, setVoice] = useState(false);

  if (!isLoggedIn) {
    return (
      <div className="rounded-card border border-line bg-paper p-8 text-center shadow-soft">
        <p className="font-display text-xl font-bold">Sign in to add a memory</p>
        <a href="/sign-in?next=/memories/new" className="mt-5 inline-block rounded-pill px-6 py-3 font-semibold text-white" style={{ background: MEMORIES }}>Sign in or create account</a>
      </div>
    );
  }

  function addFile(kind: "photo" | "video", file: File | null) {
    if (!file) return;
    setDrafts((d) => [...d, { kind, file, name: file.name, preview: URL.createObjectURL(file) }]);
  }
  function toggleTag(s: string) { setTags((t) => t.includes(s) ? t.filter((x) => x !== s) : [...t, s]); }

  async function save() {
    if (!parentId && !existing && !loc) { setError("Choose where on the map this memory belongs."); return; }
    if (!title.trim() && !body.trim() && drafts.length === 0) { setError("Add a story or some media."); return; }
    setError(null); setBusy(true);
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error("Please sign in.");
      let memoryId: string;
      if (existing) {
        const { error: uErr } = await sb.from("memories").update({
          lat: loc?.lat ?? null, lng: loc?.lng ?? null, place_name: placeName.trim() || null,
          era: era.trim() || null, tags, title: title.trim() || null, body: body.trim() || null,
          visibility, updated_at: new Date().toISOString(),
        }).eq("id", existing.id);
        if (uErr) throw uErr;
        memoryId = existing.id;
      } else {
        const { data: memory, error: mErr } = await sb.from("memories").insert({
          author_id: user.id, lat: loc?.lat ?? null, lng: loc?.lng ?? null, place_name: placeName.trim() || null,
          parent_id: parentId ?? null, era: era.trim() || null, tags, title: title.trim() || null, body: body.trim() || null, visibility,
        }).select("id").single();
        if (mErr) throw mErr;
        memoryId = memory.id as string;
      }

      for (let i = 0; i < drafts.length; i++) {
        const d = drafts[i];
        const ext = d.kind === "audio" ? "webm" : (d.name.split(".").pop()?.toLowerCase() || (d.kind === "video" ? "mp4" : "jpg"));
        const path = `${memoryId}/${d.kind}/${Date.now()}-${i}.${ext}`;
        const { error: upErr } = await sb.storage.from("memories-media").upload(path, d.file, { upsert: true, contentType: d.file.type || undefined });
        if (upErr) throw upErr;
        const url = sb.storage.from("memories-media").getPublicUrl(path).data.publicUrl;
        await sb.from("memory_media").insert({
          memory_id: memoryId, uploader_id: user.id, kind: d.kind, url, storage_path: path,
          duration_seconds: d.durationSec ?? null, display_order: i, transcript_status: d.kind === "audio" ? "pending" : "none",
        });
        // Transcription is run (and shown) on the detail page by AudioTranscriber.
      }
      router.push(`/memories/${memoryId}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save the memory."); setBusy(false); }
  }

  const pill = (on: boolean) => "rounded-pill border px-3 py-1.5 text-sm font-semibold transition " + (on ? "text-white" : "border-line bg-sand text-ink hover:border-line-strong");
  const pillStyle = (on: boolean) => on ? { background: MEMORIES, borderColor: MEMORIES } : undefined;

  return (
    <div className="space-y-8">
      {!parentId && (
        <section className="rounded-card border border-line bg-paper p-6 shadow-soft">
          <h2 className="mb-3 font-display text-xl font-bold text-ink">Where is it?</h2>
          <MemoryMap mode="pick" value={loc} height={340} onPick={(lat, lng, name) => { setLoc({ lat, lng }); if (name) setPlaceName(name); }} />
          {loc && <p className="mt-2 text-sm text-ink-muted">📍 {loc.lat.toFixed(4)}°N, {Math.abs(loc.lng).toFixed(4)}°W</p>}
          <input value={placeName} onChange={(e) => setPlaceName(e.target.value)} placeholder="Place name (optional) — e.g. Hillswick pier" className="auth-input mt-3" />
        </section>
      )}

      <section className="rounded-card border border-line bg-paper p-6 shadow-soft">
        <h2 className="mb-3 font-display text-xl font-bold text-ink">The memory</h2>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" className="auth-input" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="Tell the story…" className="auth-input mt-3 resize-none" />
        <p className="mb-2 mt-4 text-sm font-semibold text-ink">When</p>
        <div className="flex flex-wrap gap-2">
          {ERA_SUGGESTIONS.map((e) => <button key={e} type="button" onClick={() => setEra(era === e ? "" : e)} className={pill(era === e)} style={pillStyle(era === e)}>{e}</button>)}
        </div>
        <input value={era} onChange={(e) => setEra(e.target.value)} placeholder="…or type an era" className="auth-input mt-2" />
      </section>

      <section className="rounded-card border border-line bg-paper p-6 shadow-soft">
        <h2 className="mb-3 font-display text-xl font-bold text-ink">What's it about?</h2>
        <div className="flex flex-wrap gap-2">
          {MEMORY_CATEGORIES.map((c) => <button key={c.slug} type="button" onClick={() => toggleTag(c.slug)} className={pill(tags.includes(c.slug))} style={pillStyle(tags.includes(c.slug))}>{c.icon} {c.label}</button>)}
        </div>
      </section>

      <section className="rounded-card border border-line bg-paper p-6 shadow-soft">
        <h2 className="mb-3 font-display text-xl font-bold text-ink">Photos, video & voice</h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => photoRef.current?.click()} className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink hover:bg-sand">📷 Add photo</button>
          <button type="button" onClick={() => videoRef.current?.click()} className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink hover:bg-sand">🎬 Add video</button>
          <button type="button" onClick={() => setVoice((v) => !v)} className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink hover:bg-sand">🎙 Voice note</button>
          <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => addFile("photo", e.target.files?.[0] ?? null)} />
          <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={(e) => addFile("video", e.target.files?.[0] ?? null)} />
        </div>
        <p className="mt-2 rounded-lg bg-sand/60 px-3 py-2 text-xs text-ink-soft">
          🎙 <span className="font-semibold text-ink">Voice notes are turned into text automatically.</span> Record your note and save the memory — the written transcript appears on the memory's page a few seconds after you open it (it's also searchable). Allow microphone access when your browser asks.
        </p>
        {Voice && (
          <div className="mt-3">
            <VoiceRecorder onRecorded={(blob, dur) => { setDrafts((d) => [...d, { kind: "audio", file: blob, name: "voice.webm", durationSec: dur, preview: URL.createObjectURL(blob) }]); setVoice(false); }} />
          </div>
        )}
        {drafts.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {drafts.map((d, i) => (
              <div key={i} className="relative overflow-hidden rounded-card border border-line">
                {d.kind === "photo" && <img src={d.preview} alt="" className="h-28 w-full object-cover" />}
                {d.kind === "video" && <video src={d.preview} className="h-28 w-full object-cover" />}
                {d.kind === "audio" && <div className="grid h-28 w-full place-items-center bg-sand text-sm text-ink-soft">🎙 Voice note{d.durationSec ? ` · ${d.durationSec}s` : ""}</div>}
                <button type="button" onClick={() => setDrafts((arr) => arr.filter((_, j) => j !== i))} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/55 text-xs font-bold text-white">✕</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-card border border-line bg-paper p-6 shadow-soft">
        <h2 className="mb-3 font-display text-xl font-bold text-ink">Who can see it?</h2>
        <div className="flex flex-wrap gap-2">
          {([["public", "Public — anyone"], ["community", "Community — signed-in folk"], ["private", "Private — just me"]] as [Visibility, string][]).map(([v, label]) => (
            <button key={v} type="button" onClick={() => setVisibility(v)} className={pill(visibility === v)} style={pillStyle(visibility === v)}>{label}</button>
          ))}
        </div>
      </section>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
      <button onClick={save} disabled={busy} className="w-full rounded-pill py-3 font-semibold text-white transition hover:brightness-110 disabled:opacity-40" style={{ background: MEMORIES }}>
        {busy ? "Saving…" : existing ? "Save changes" : parentId ? "Add to memory" : "Save memory"}
      </button>
    </div>
  );
}
