"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { REACTIONS, type ReactionKind, type MemoryComment, authorName, MEMORIES } from "@/lib/memories-data";

function rel(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now"; if (m < 60) return `${m}m`; const h = Math.round(m / 60); if (h < 24) return `${h}h`;
  const d = Math.round(h / 24); if (d < 7) return `${d}d`; return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function MemoryInteractions({ memoryId, counts, mine, comments, isLoggedIn, userId, isAuthor }: {
  memoryId: string; counts: Partial<Record<ReactionKind, number>>; mine: ReactionKind[];
  comments: MemoryComment[]; isLoggedIn: boolean; userId: string | null; isAuthor: boolean;
}) {
  const router = useRouter();
  const [react, setReact] = useState<Partial<Record<ReactionKind, number>>>(counts);
  const [myReacts, setMyReacts] = useState<ReactionKind[]>(mine);
  const [list, setList] = useState(comments);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function toggle(kind: ReactionKind) {
    if (!isLoggedIn) { window.location.href = `/sign-in?next=/memories/${memoryId}`; return; }
    const has = myReacts.includes(kind);
    setMyReacts((m) => has ? m.filter((k) => k !== kind) : [...m, kind]);
    setReact((r) => ({ ...r, [kind]: Math.max(0, (r[kind] ?? 0) + (has ? -1 : 1)) }));
    const sb = createClient(); const { data: { user } } = await sb.auth.getUser(); if (!user) return;
    if (has) await sb.from("memory_reactions").delete().eq("memory_id", memoryId).eq("user_id", user.id).eq("kind", kind);
    else {
      await sb.from("memory_reactions").insert({ memory_id: memoryId, user_id: user.id, kind });
      sb.functions.invoke("notify-engagement", { body: { event: "memory_reaction", memory_id: memoryId, actor_id: user.id } }).catch(() => {});
    }
  }

  async function post() {
    if (!body.trim()) return;
    setBusy(true);
    try {
      const sb = createClient(); const { data: { user } } = await sb.auth.getUser(); if (!user) throw new Error("Sign in");
      const { data } = await sb.from("memory_comments").insert({ memory_id: memoryId, author_id: user.id, body: body.trim() }).select("*, author:profiles(id, full_name, display_name, avatar_url)").single();
      if (data) {
        setList((l) => [...l, data as MemoryComment]);
        sb.functions.invoke("notify-engagement", { body: { event: "memory_comment", comment_id: (data as MemoryComment).id } }).catch(() => {});
      }
      setBody(""); router.refresh();
    } finally { setBusy(false); }
  }
  async function del(id: string) {
    await createClient().from("memory_comments").delete().eq("id", id);
    setList((l) => l.filter((c) => c.id !== id)); router.refresh();
  }
  async function deleteMemory() {
    if (!confirm("Delete this memory for good?")) return;
    await createClient().from("memories").delete().eq("id", memoryId);
    router.push("/memories");
  }

  return (
    <div className="space-y-6">
      {/* Reactions */}
      <div className="flex flex-wrap gap-2">
        {REACTIONS.map((r) => {
          const on = myReacts.includes(r.kind); const n = react[r.kind] ?? 0;
          return (
            <button key={r.kind} onClick={() => toggle(r.kind)} className={"flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-sm font-semibold transition " + (on ? "text-white" : "border-line-strong text-ink-soft hover:bg-sand")} style={on ? { background: MEMORIES, borderColor: MEMORIES } : undefined}>
              <span>{r.icon}</span>{r.label}{n > 0 && <span className="opacity-80">{n}</span>}
            </button>
          );
        })}
        {isAuthor && <button onClick={deleteMemory} className="ml-auto rounded-pill border border-line-strong px-3 py-1.5 text-sm font-semibold text-rose-600 hover:bg-rose-50">Delete memory</button>}
      </div>

      {/* Comments */}
      <section className="rounded-card border border-line bg-paper p-6 shadow-soft">
        <h3 className="font-display text-xl font-bold text-ink">Comments {list.length > 0 && <span className="text-ink-faint">· {list.length}</span>}</h3>
        {isLoggedIn ? (
          <div className="mt-4 flex gap-2">
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Add a comment or share what you ken…" className="auth-input flex-1 resize-none" />
            <button onClick={post} disabled={busy || !body.trim()} className="shrink-0 self-end rounded-pill px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40" style={{ background: MEMORIES }}>Post</button>
          </div>
        ) : (
          <a href={`/sign-in?next=/memories/${memoryId}`} className="mt-4 inline-block rounded-pill px-4 py-2.5 text-sm font-semibold text-white" style={{ background: MEMORIES }}>Sign in to comment</a>
        )}
        <div className="mt-5 space-y-4">
          {list.length === 0 ? <p className="text-sm text-ink-muted">No comments yet — be the first.</p> : list.map((c) => (
            <div key={c.id} className="flex items-start gap-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-sand text-xs font-bold text-ink-faint">
                {c.author?.avatar_url ? <img src={c.author.avatar_url} alt="" className="h-full w-full object-cover" /> : authorName(c.author).slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm"><span className="font-bold text-ink">{authorName(c.author)}</span> <span className="text-ink-faint">{rel(c.created_at)}</span></p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink-soft">{c.body}</p>
              </div>
              {(c.author_id === userId || isAuthor) && <button onClick={() => del(c.id)} className="shrink-0 text-xs font-semibold text-ink-faint hover:text-rose-600">Delete</button>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
