"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LatestEditorial } from "@/components/home/LatestEditorial";
import {
  ANNOUNCEMENT_COLUMNS, ANNOUNCEMENT_LIMITS, KIND_LABEL, VISUAL_LABEL, VISUALS, announcementState, blankDraft, draftFromAnnouncement, draftToRow, isLiveNow,
  readAnnouncements, safeImage, validateAnnouncementDraft, type Announcement, type AnnouncementDraft, type AnnouncementState,
} from "@/lib/home-announcements";

/**
 * Admin → Announcements. Everything is written with the administrator's own session: the database (RLS) refuses anyone else, so this screen can
 * never grant more than the role has. Order is the featured order: the first LIVE story is featured. Images upload to the site-media bucket
 * (public read, admin write), the same place the homepage image uses.
 */
const field = "auth-input w-full";
const btn = "min-h-11 rounded-pill border border-line-strong px-4 text-sm font-bold text-ink-soft transition hover:bg-sand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:opacity-50";
const btnPrimary = "min-h-11 rounded-pill bg-navy px-5 text-sm font-bold text-white transition hover:bg-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:opacity-50";
const STATE_TONE: Record<AnnouncementState, string> = { live: "bg-emerald-100 text-emerald-900", scheduled: "bg-sky-100 text-sky-900", ended: "bg-slate-200 text-slate-700", draft: "bg-sand text-ink-soft", withdrawn: "bg-rose-100 text-rose-900" };
const STATE_LABEL: Record<AnnouncementState, string> = { live: "Live", scheduled: "Scheduled", ended: "Ended", draft: "Draft", withdrawn: "Withdrawn" };
const FILTERS: { key: "all" | AnnouncementState; label: string }[] = [{ key: "all", label: "All" }, { key: "live", label: "Live" }, { key: "scheduled", label: "Scheduled" }, { key: "draft", label: "Drafts" }, { key: "ended", label: "Ended" }, { key: "withdrawn", label: "Withdrawn" }];
const when = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(iso)) : null);

export function AnnouncementsAdmin({ initial }: { initial: Announcement[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Announcement[]>(initial);
  const [filter, setFilter] = useState<"all" | AnnouncementState>("all");
  const [editing, setEditing] = useState<{ id: string | null; draft: AnnouncementDraft } | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const errors = useMemo(() => (editing ? validateAnnouncementDraft(editing.draft) : {}), [editing]);
  const hasErrors = Object.keys(errors).length > 0;
  const shown = rows.filter((r) => filter === "all" || announcementState(r, now) === filter);
  const liveCount = rows.filter((r) => isLiveNow(r, now)).length;

  async function reload() {
    const { data, error } = await createClient().from("home_announcements").select(ANNOUNCEMENT_COLUMNS).order("sort_order", { ascending: true }).order("created_at", { ascending: false }).limit(500);
    if (!error) setRows(readAnnouncements(data));
    setNow(Date.now());
    router.refresh();
  }
  async function run(label: string, fn: () => Promise<{ error: { message: string } | null }>) {
    setBusy(true); setMsg(null);
    try {
      const { error } = await fn();
      if (error) { setMsg({ ok: false, text: `Failed: ${error.message}` }); return false; }
      await reload(); setMsg({ ok: true, text: label }); return true;
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? `Failed: ${e.message}` : "Failed." }); return false; }
    finally { setBusy(false); }
  }
  const sb = () => createClient();

  async function save() {
    if (!editing || hasErrors) return;
    const row = draftToRow(editing.draft);
    const ok = await run(editing.draft.status === "published" ? "Saved. It shows on the homepage within a minute while it is live." : "Saved.", async () => {
      if (editing.id) return sb().from("home_announcements").update(row).eq("id", editing.id);
      const { data: { user } } = await sb().auth.getUser();
      const next = rows.length ? Math.max(...rows.map((r) => r.sortOrder)) + 1 : 1;
      return sb().from("home_announcements").insert({ ...row, sort_order: next, created_by: user?.id ?? null });
    });
    if (ok) setEditing(null);
  }
  const setStatus = (a: Announcement, status: "published" | "withdrawn" | "draft") =>
    run(status === "published" ? `Published “${a.title}”.` : status === "withdrawn" ? `Withdrew “${a.title}”. It is off the homepage.` : `Moved “${a.title}” back to drafts.`, async () => sb().from("home_announcements").update({ status }).eq("id", a.id));
  const reorder = (ids: string[], text: string) => run(text, async () => sb().rpc("admin_home_announcements_reorder", { p_ids: ids }));
  const move = (a: Announcement, d: -1 | 1) => { const ids = rows.map((r) => r.id); const i = ids.indexOf(a.id), j = i + d; if (j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; return reorder(ids, "Order saved."); };
  const feature = (a: Announcement) => reorder([a.id, ...rows.filter((r) => r.id !== a.id).map((r) => r.id)], `“${a.title}” is now first in the order, so it is the featured story while it is live.`);
  const duplicate = (a: Announcement) => setEditing({ id: null, draft: { ...draftFromAnnouncement(a), status: "draft", startsLocal: "", endsLocal: "", title: a.title.slice(0, ANNOUNCEMENT_LIMITS.title) } });
  const remove = (a: Announcement) => run(`Deleted “${a.title}”.`, async () => sb().from("home_announcements").delete().eq("id", a.id));

  async function upload(file: File) {
    setUploading(true); setMsg(null);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
      const path = `announcement-${Date.now()}.${ext}`;
      const { error } = await sb().storage.from("site-media").upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const url = sb().storage.from("site-media").getPublicUrl(path).data.publicUrl;
      setEditing((e) => (e ? { ...e, draft: { ...e.draft, image: url } } : e));
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? `Upload failed: ${e.message}` : "Upload failed." }); }
    finally { setUploading(false); }
  }

  const d = editing?.draft;
  const set = (patch: Partial<AnnouncementDraft>) => setEditing((e) => (e ? { ...e, draft: { ...e.draft, ...patch } } : e));
  const previewItem: Announcement | null = d && !hasErrors ? { id: "00000000-0000-4000-8000-000000000000", kind: d.kind, title: d.title.trim(), body: d.body.trim(), cta: d.cta.trim(), href: d.href, visual: d.visual, image: safeImage(d.image), status: "published", starts: null, ends: null, sortOrder: 0 } : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)} className={`min-h-10 rounded-pill border px-3.5 text-[13px] font-bold ${filter === f.key ? "border-navy bg-navy text-white" : "border-line-strong bg-paper text-ink-soft"}`}>{f.label}</button>)}
        </div>
        <button type="button" className={btnPrimary} onClick={() => { setMsg(null); setEditing({ id: null, draft: blankDraft() }); }}>New announcement</button>
      </div>

      <p role="status" aria-live="polite" className={`min-h-6 text-sm font-semibold ${msg?.ok ? "text-emerald-800" : "text-rose-700"}`}>{msg?.text}</p>
      {liveCount === 0 && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Nothing is live, so Latest from OneShetland is hidden on the homepage.</p>}
      {liveCount > 3 && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{liveCount} stories are live. The homepage shows the first three in this order: the featured story and two supporting ones.</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,430px)]">
        <ul className="space-y-2" aria-label="Announcements">
          {shown.map((a) => {
            const st = announcementState(a, now);
            const idx = rows.findIndex((r) => r.id === a.id);
            const firstLive = rows.find((r) => isLiveNow(r, now))?.id === a.id;
            return (
              <li key={a.id} className="rounded-card border border-line bg-paper p-3.5 shadow-soft">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-pill px-2.5 py-0.5 text-[11px] font-bold ${STATE_TONE[st]}`}>{STATE_LABEL[st]}</span>
                  {firstLive && <span className="rounded-pill bg-navy px-2.5 py-0.5 text-[11px] font-bold text-white">Featured</span>}
                  <span className="text-[12px] font-semibold text-ink-muted">{KIND_LABEL[a.kind]} · {VISUAL_LABEL[a.visual]}</span>
                  <span className="ml-auto text-[12px] tabular-nums text-ink-muted">{when(a.starts) ?? "no start"} to {when(a.ends) ?? "no end"}</span>
                </div>
                <p className="mt-1.5 font-semibold text-ink">{a.title}</p>
                <p className="truncate text-[13px] text-ink-muted">{a.cta} → {a.href}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button type="button" className={btn} disabled={busy} onClick={() => { setMsg(null); setEditing({ id: a.id, draft: draftFromAnnouncement(a) }); }}>Edit</button>
                  {a.status !== "published" ? <button type="button" className={btn} disabled={busy} onClick={() => setStatus(a, "published")}>Publish</button> : <button type="button" className={btn} disabled={busy} onClick={() => setStatus(a, "withdrawn")}>Withdraw</button>}
                  {st === "live" && !firstLive && <button type="button" className={btn} disabled={busy} onClick={() => feature(a)}>Make featured</button>}
                  <button type="button" className={btn} disabled={busy} onClick={() => duplicate(a)}>Duplicate</button>
                  {confirmDelete === a.id
                    ? <><button type="button" className="min-h-11 rounded-pill bg-rose-700 px-4 text-sm font-bold text-white" disabled={busy} onClick={() => { setConfirmDelete(null); remove(a); }}>Confirm delete</button><button type="button" className={btn} onClick={() => setConfirmDelete(null)}>Keep</button></>
                    : <button type="button" className={`${btn} text-rose-700`} disabled={busy} onClick={() => setConfirmDelete(a.id)}>Delete</button>}
                  <span className="ml-auto flex gap-1">
                    <button type="button" aria-label={`Move “${a.title}” up`} disabled={busy || idx <= 0} onClick={() => move(a, -1)} className="grid h-11 w-11 place-items-center rounded-full border border-line-strong disabled:opacity-40">↑</button>
                    <button type="button" aria-label={`Move “${a.title}” down`} disabled={busy || idx >= rows.length - 1} onClick={() => move(a, 1)} className="grid h-11 w-11 place-items-center rounded-full border border-line-strong disabled:opacity-40">↓</button>
                  </span>
                </div>
              </li>
            );
          })}
          {shown.length === 0 && <li className="rounded-card border border-dashed border-line-strong p-5 text-sm text-ink-muted">{rows.length === 0 ? "No announcements yet. Choose New announcement to write the first one." : "Nothing with this status."}</li>}
        </ul>

        <aside>
          {d ? (
            <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="space-y-3 rounded-card border border-line bg-paper p-4 shadow-soft" aria-label={editing?.id ? "Edit announcement" : "New announcement"} noValidate>
              <h2 className="font-display text-xl font-bold text-ink">{editing?.id ? "Edit announcement" : "New announcement"}</h2>
              <fieldset><legend className="mb-1 text-sm font-semibold text-ink">Type</legend>
                <div className="flex gap-2">
                  {(["new", "know"] as const).map((k) => (
                    <label key={k} className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-xl border text-sm font-bold ${d.kind === k ? "border-navy bg-navy text-white" : "border-line-strong text-ink-soft"}`}>
                      <input type="radio" name="kind" className="sr-only" checked={d.kind === k} onChange={() => set({ kind: k })} />{KIND_LABEL[k]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div><label htmlFor="an-title" className="mb-1 flex justify-between text-sm font-semibold text-ink">Headline<span className="font-normal text-ink-muted tabular-nums">{d.title.length}/{ANNOUNCEMENT_LIMITS.title}</span></label>
                <input id="an-title" className={field} value={d.title} onChange={(e) => set({ title: e.target.value })} aria-invalid={!!errors.title} />{errors.title && <p className="mt-1 text-[13px] font-semibold text-rose-700">{errors.title}</p>}</div>
              <div><label htmlFor="an-body" className="mb-1 flex justify-between text-sm font-semibold text-ink">Description<span className="font-normal text-ink-muted tabular-nums">{d.body.length}/{ANNOUNCEMENT_LIMITS.body}</span></label>
                <textarea id="an-body" rows={3} className={field} value={d.body} onChange={(e) => set({ body: e.target.value })} aria-invalid={!!errors.body} />{errors.body && <p className="mt-1 text-[13px] font-semibold text-rose-700">{errors.body}</p>}</div>
              <div className="grid grid-cols-2 gap-3">
                <div><label htmlFor="an-cta" className="mb-1 block text-sm font-semibold text-ink">Link words</label><input id="an-cta" className={field} value={d.cta} onChange={(e) => set({ cta: e.target.value })} aria-invalid={!!errors.cta} />{errors.cta && <p className="mt-1 text-[13px] font-semibold text-rose-700">{errors.cta}</p>}</div>
                <div><label htmlFor="an-vis" className="mb-1 block text-sm font-semibold text-ink">Shows</label><select id="an-vis" className={field} value={d.visual} onChange={(e) => set({ visual: e.target.value as AnnouncementDraft["visual"] })}>{VISUALS.map((v) => <option key={v} value={v}>{VISUAL_LABEL[v]}</option>)}</select></div>
              </div>
              <div><label htmlFor="an-href" className="mb-1 block text-sm font-semibold text-ink">Where it goes</label><input id="an-href" className={field} value={d.href} onChange={(e) => set({ href: e.target.value })} placeholder="/account/saved or https://…" aria-invalid={!!errors.href} />{errors.href && <p className="mt-1 text-[13px] font-semibold text-rose-700">{errors.href}</p>}</div>
              <div>
                <span className="mb-1 block text-sm font-semibold text-ink">Photograph {d.visual !== "photo" && <span className="font-normal text-ink-muted">(optional; a faint backdrop on the featured story)</span>}</span>
                <div className="flex items-center gap-3">
                  <div className="grid h-16 w-24 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-sand/40 text-xs text-ink-muted">{safeImage(d.image) ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={safeImage(d.image) as string} alt="" className="h-full w-full object-cover" /> : "None"}</div>
                  <div className="flex flex-col gap-1.5">
                    <label className={`${btn} inline-flex cursor-pointer items-center`}>{uploading ? "Uploading…" : "Upload image"}<input type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} /></label>
                    {d.image && <button type="button" className="text-left text-xs font-semibold text-rose-700 hover:underline" onClick={() => set({ image: "" })}>Remove image</button>}
                  </div>
                </div>
                <label htmlFor="an-img" className="mb-1 mt-2 block text-[13px] text-ink-muted">Or paste an image address</label>
                <input id="an-img" className={field} value={d.image} onChange={(e) => set({ image: e.target.value })} placeholder="https://… or /heroes/events.jpg" aria-invalid={!!errors.image} />{errors.image && <p className="mt-1 text-[13px] font-semibold text-rose-700">{errors.image}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label htmlFor="an-s" className="mb-1 block text-sm font-semibold text-ink">Shows from</label><input id="an-s" type="datetime-local" className={field} value={d.startsLocal} onChange={(e) => set({ startsLocal: e.target.value })} />{errors.starts && <p className="mt-1 text-[13px] font-semibold text-rose-700">{errors.starts}</p>}</div>
                <div><label htmlFor="an-e" className="mb-1 block text-sm font-semibold text-ink">Until</label><input id="an-e" type="datetime-local" className={field} value={d.endsLocal} onChange={(e) => set({ endsLocal: e.target.value })} aria-invalid={!!errors.ends} />{errors.ends && <p className="mt-1 text-[13px] font-semibold text-rose-700">{errors.ends}</p>}</div>
              </div>
              <p className="text-[12px] text-ink-muted">Times are Shetland time. Leave both empty to show it as soon as it is published, until you withdraw it.</p>
              <div><label htmlFor="an-st" className="mb-1 block text-sm font-semibold text-ink">Status</label>
                <select id="an-st" className={field} value={d.status} onChange={(e) => set({ status: e.target.value as AnnouncementDraft["status"] })}><option value="draft">Draft (not shown)</option><option value="published">Published (shown between the dates)</option><option value="withdrawn">Withdrawn (not shown)</option></select></div>
              <div className="flex gap-2 pt-1">
                <button type="submit" className={`${btnPrimary} flex-1`} disabled={busy || hasErrors}>Save</button>
                <button type="button" className={btn} onClick={() => setEditing(null)}>Cancel</button>
              </div>
            </form>
          ) : <div className="rounded-card border border-dashed border-line-strong p-5 text-sm text-ink-soft">Choose Edit on a story, or New announcement. The preview below shows what visitors see right now.</div>}
        </aside>
      </div>

      <section aria-label="Preview">
        <h2 className="font-display text-xl font-bold text-ink">{previewItem ? "Preview of the story you are editing" : "What visitors see right now"}</h2>
        <p className="mb-2 text-sm text-ink-muted">{previewItem ? "Shown as if published. Save and publish to put it on the homepage." : "Live stories only, in this order."}</p>
        <div className="overflow-hidden rounded-card border border-line">{previewItem ? <LatestEditorial items={[previewItem]} /> : liveCount > 0 ? <LatestEditorial items={rows} /> : <p className="p-5 text-sm text-ink-muted">Nothing is live: the section does not appear.</p>}</div>
      </section>
    </div>
  );
}
