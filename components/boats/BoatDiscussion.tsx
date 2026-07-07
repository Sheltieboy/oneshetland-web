"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ContentActions } from "@/components/moderation/ContentActions";
import { type VesselComment, COMMENT_SUBJECTS, commentSubjectLabel, BOATS } from "@/lib/boats-data";

function rel(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now"; if (m < 60) return `${m}m`; const h = Math.round(m / 60); if (h < 24) return `${h}h`;
  const d = Math.round(h / 24); if (d < 7) return `${d}d`; return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
const who = (a: VesselComment["author"]) => a?.display_name || a?.full_name || "Someone";

/** Stable id of the "community uploads" source (migration 20260701093000). */
const COMMUNITY_SOURCE_ID = "00000000-0000-4000-8000-0000000da404";

export function BoatDiscussion({ vesselId, comments, isLoggedIn, userId }: { vesselId: string; comments: VesselComment[]; isLoggedIn: boolean; userId: string | null }) {
  const router = useRouter();
  const [subject, setSubject] = useState("general");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [photoOfBoat, setPhotoOfBoat] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function post() {
    if (!body.trim() && !file) return;
    setBusy(true); setError(null);
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error("Please sign in.");
      let image_url: string | null = null, image_path: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        image_path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await sb.storage.from("boat-comment-media").upload(image_path, file, { upsert: true, contentType: file.type });
        if (upErr) throw upErr;
        image_url = sb.storage.from("boat-comment-media").getPublicUrl(image_path).data.publicUrl;
      }
      // NB: vessel_comments has no image columns — a photo attached to a comment is
      // stored via media_assets + vessel_media_links (the gallery), below. Sending
      // image_url/image_path here 400s the insert and blocks ALL posts (even text).
      const { data: cRow, error: dbErr } = await sb.from("vessel_comments").insert({
        vessel_id: vesselId, author_id: user.id, subject_type: replyTo ? "general" : subject,
        parent_comment_id: replyTo?.id ?? null, body: body.trim(),
      }).select("id").single();
      if (dbErr) throw dbErr;
      if (cRow?.id) sb.functions.invoke("notify-engagement", { body: { event: "vessel_comment", comment_id: cRow.id } }).catch(() => {});

      // "This is a photo of the boat" → also submit to the gallery as a pending
      // community contribution (moderated; hidden until an admin approves it).
      // Reuses the already-uploaded image. Best-effort: the comment is posted
      // regardless, so a gallery failure only warns.
      if (photoOfBoat && image_url && !replyTo) {
        try {
          const { data: asset, error: aErr } = await sb.from("media_assets").insert({
            source_document_id: COMMUNITY_SOURCE_ID, asset_type: "photo",
            image_url, submitted_by: user.id, approval_status: "pending",
            rights_note: "Community submission — pending review",
          }).select("id").single();
          if (aErr) throw aErr;
          if (asset?.id) {
            const { error: lErr } = await sb.from("vessel_media_links").insert({
              vessel_id: vesselId, media_asset_id: asset.id, confidence: "possible",
              notes: "Submitted via discussion — awaiting approval",
            });
            if (lErr) throw lErr;
          }
        } catch (e) { console.warn("[boats] gallery photo submission failed (comment still posted):", e); }
      }

      setBody(""); setFile(null); setReplyTo(null); setSubject("general"); setPhotoOfBoat(false);
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not post."); }
    finally { setBusy(false); }
  }

  async function del(id: string) {
    if (!confirm("Delete your comment?")) return;
    await createClient().from("vessel_comments").delete().eq("id", id);
    router.refresh();
  }

  async function saveEdit() {
    if (!editing || !editing.body.trim()) return;
    setBusy(true); setError(null);
    try {
      const { error: dbErr } = await createClient().from("vessel_comments")
        .update({ body: editing.body.trim(), edited_at: new Date().toISOString() })
        .eq("id", editing.id);
      if (dbErr) throw dbErr;
      setEditing(null);
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save."); }
    finally { setBusy(false); }
  }

  const Node = ({ c, isReply }: { c: VesselComment; isReply?: boolean }) => (
    <div className={isReply ? "ml-10 mt-3" : "border-t border-line pt-4"}>
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-sand text-sm font-bold text-ink-faint">
          {c.author?.avatar_url ? <img src={c.author.avatar_url} alt="" className="h-full w-full object-cover" /> : who(c.author).slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm"><span className="font-bold text-ink">{who(c.author)}</span>{c.subject_type !== "general" && <span className="ml-2 rounded-pill bg-sand px-2 py-0.5 text-[11px] font-bold text-ink-soft">{commentSubjectLabel(c.subject_type)}</span>}<span className="ml-2 text-ink-faint">{rel(c.created_at)}{c.edited_at ? " · edited" : ""}</span></p>
          {editing?.id === c.id ? (
            <div className="mt-1.5">
              <textarea value={editing.body} onChange={(e) => setEditing({ id: c.id, body: e.target.value })} rows={3} className="auth-input resize-none" />
              {error && <p className="mt-1 text-sm text-rose-600">{error}</p>}
              <div className="mt-1.5 flex gap-2">
                <button onClick={saveEdit} disabled={busy || !editing.body.trim()} className="rounded-pill px-4 py-1 text-sm font-semibold text-white disabled:opacity-40" style={{ background: BOATS }}>{busy ? "Saving…" : "Save"}</button>
                <button onClick={() => { setEditing(null); setError(null); }} className="rounded-pill border border-line-strong px-4 py-1 text-sm font-semibold text-ink-soft hover:bg-sand">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              {c.body && <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{c.body}</p>}
              {c.image_url && <img src={c.image_url} alt="" className="mt-2 max-h-64 rounded-card border border-line object-cover" />}
              <div className="mt-1.5 flex gap-3 text-xs font-semibold text-ink-faint">
                {isLoggedIn && !isReply && <button onClick={() => { setReplyTo({ id: c.id, name: who(c.author) }); }} className="hover:text-ink">Reply</button>}
                {c.author_id === userId && <button onClick={() => { setEditing({ id: c.id, body: c.body }); setError(null); }} className="hover:text-ink">Edit</button>}
                {c.author_id === userId && <button onClick={() => del(c.id)} className="hover:text-rose-600">Delete</button>}
                {isLoggedIn && c.author_id !== userId && (
                  <ContentActions
                    contentType="vessel_comment"
                    contentId={c.id}
                    authorId={c.author_id}
                    authorName={who(c.author)}
                    viewerId={userId}
                    onBlocked={() => router.refresh()}
                    accent={BOATS}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>
      {c.replies?.map((r) => <Node key={r.id} c={r} isReply />)}
    </div>
  );

  return (
    <section className="rounded-card border border-line bg-paper p-6 shadow-soft">
      <h3 className="font-display text-xl font-bold text-ink">Discussion</h3>
      <p className="mt-0.5 text-sm text-ink-muted">Share what you ken — a memory, a correction, or a photo.</p>

      {/* Composer */}
      {isLoggedIn ? (
        <div className="mt-4 rounded-card border border-line bg-cream/40 p-3">
          {replyTo && <p className="mb-2 text-sm text-ink-soft">Replying to <b>{replyTo.name}</b> <button onClick={() => setReplyTo(null)} className="ml-1 text-ink-faint hover:text-ink" aria-label="Cancel reply">✕</button></p>}
          {!replyTo && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {COMMENT_SUBJECTS.map((s) => (
                <button key={s.slug} onClick={() => setSubject(s.slug)} className={"rounded-pill px-2.5 py-1 text-xs font-semibold " + (subject === s.slug ? "text-white" : "bg-sand text-ink-soft")} style={subject === s.slug ? { background: BOATS } : undefined}>{s.label}</button>
              ))}
            </div>
          )}
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Write something…" className="auth-input resize-none" />
          {file && <p className="mt-1 text-xs text-ink-muted"><span aria-hidden="true">📷</span> {file.name} <button onClick={() => { setFile(null); setPhotoOfBoat(false); }} className="text-ink-faint" aria-label={`Remove photo ${file.name}`}>remove</button></p>}
          {file && !replyTo && (
            <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm text-ink-soft">
              <input type="checkbox" checked={photoOfBoat} onChange={(e) => setPhotoOfBoat(e.target.checked)} className="mt-0.5 h-4 w-4" style={{ accentColor: BOATS }} />
              <span><b className="text-ink">This is a photo of the boat</b><br /><span className="text-xs text-ink-muted">Add it to her Photos — shown once a moderator approves it.</span></span>
            </label>
          )}
          {error && <p className="mt-1 text-sm text-rose-600">{error}</p>}
          <div className="mt-2 flex items-center gap-2">
            <button onClick={() => fileRef.current?.click()} className="rounded-pill border border-line-strong px-3 py-1.5 text-sm font-semibold text-ink hover:bg-sand" aria-label="Attach a photo"><span aria-hidden="true">📷</span> Photo</button>
            <input ref={fileRef} type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="hidden" />
            <button onClick={post} disabled={busy || (!body.trim() && !file)} className="ml-auto rounded-pill px-5 py-1.5 text-sm font-semibold text-white disabled:opacity-40" style={{ background: BOATS }}>{busy ? "Posting…" : "Post"}</button>
          </div>
        </div>
      ) : (
        <a href={`/sign-in?next=/boats/${vesselId}`} className="mt-4 inline-block rounded-pill px-4 py-2.5 text-sm font-semibold text-white" style={{ background: BOATS }}>Sign in to join the discussion</a>
      )}

      {/* Thread */}
      <div className="mt-5 space-y-1">
        {comments.length === 0 ? <p className="py-4 text-sm text-ink-muted">No comments yet — be the first.</p> : comments.map((c) => <Node key={c.id} c={c} />)}
      </div>
    </section>
  );
}
