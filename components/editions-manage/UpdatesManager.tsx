"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteUpdate, saveUpdate } from "@/app/organise/actions";
import type { EditionUpdate } from "@/lib/editions/types";
import { updateFields } from "@/lib/editions/validate";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { EmptyState, Field, Notice, Pill, btnPrimary, btnQuiet, btnSecondary, inputCls } from "./kit";
import { useAction } from "./use-action";
import { ImageUpload } from "./ImageUpload";

type Draft = { id: string | null; title: string; body: string; pinned: boolean; publish: boolean; image_url: string };
const fmt = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(iso));

export function UpdatesManager({ organiserSlug, organiserId, editionSlug, updates }: { organiserSlug: string; organiserId: string; editionSlug: string; updates: EditionUpdate[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const save = useAction();
  const del = useAction();
  const [draft, setDraft] = useState<Draft | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const existing = (id: string | null) => updates.find((u) => u.id === id)?.published_at ?? null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const v = updateFields(draft, existing(draft.id));
    if (!v.ok) return save.setMsg({ ok: false, text: v.error });
    save.run(() => saveUpdate(organiserSlug, editionSlug, draft.id, draft), { success: draft.publish ? "Update published." : "Draft saved.", onOk: () => { setDraft(null); router.refresh(); } });
  }
  async function remove(u: EditionUpdate) {
    if (!(await confirm({ title: `Delete "${u.title}"?`, body: "This update is removed for good.", confirmLabel: "Delete update", danger: true }))) return;
    del.run(() => deleteUpdate(organiserSlug, editionSlug, u.id), { onOk: () => router.refresh() });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-ink-soft">News and announcements for visitors. Pinned updates appear first. Drafts are visible only to your team.</p>
        <button type="button" className={btnPrimary} onClick={() => { setDraft({ id: null, title: "", body: "", pinned: false, publish: true, image_url: "" }); save.setMsg(null); }}>New update</button>
      </div>
      {draft && (
        <form onSubmit={submit} className="space-y-4 rounded-card border border-line bg-paper p-5 shadow-soft" noValidate>
          <Field label="Headline" htmlFor="u-title"><input id="u-title" className={inputCls} value={draft.title} onChange={(e) => set("title", e.target.value)} maxLength={140} required /></Field>
          <Field label="Message" htmlFor="u-body" hint={`${draft.body.length}/4000. Plain text.`}><textarea id="u-body" className={inputCls} rows={5} value={draft.body} onChange={(e) => set("body", e.target.value)} maxLength={4000} /></Field>
          <ImageUpload label="Photograph (optional)" organiserId={organiserId} kind="update-image" value={draft.image_url} onChange={(u) => set("image_url", u)} hint="Shown with the update on your Edition's home page and Journal. Choose a landscape photograph; it is resized for you." />
          <div className="flex flex-wrap gap-5 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={draft.pinned} onChange={(e) => set("pinned", e.target.checked)} /> Pin to the top</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={draft.publish} onChange={(e) => set("publish", e.target.checked)} /> Published (untick to keep as a draft)</label>
          </div>
          <Notice msg={save.msg} />
          <div className="flex gap-2.5"><button type="submit" disabled={save.pending} className={btnPrimary}>{save.pending ? "Saving…" : draft.publish ? "Save and publish" : "Save draft"}</button><button type="button" className={btnSecondary} onClick={() => setDraft(null)}>Cancel</button></div>
        </form>
      )}
      {updates.length === 0 ? <EmptyState>No updates yet.</EmptyState> : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-paper">
          {updates.map((u) => (
            <li key={u.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">{u.title}{u.pinned && <Pill label="Pinned" tone="blue" />}{u.published_at ? <Pill label={`Published ${fmt(u.published_at)}`} tone="green" /> : <Pill label="Draft" />}</p>
                {u.body && <p className="mt-0.5 line-clamp-2 text-sm text-ink-soft">{u.body}</p>}
              </div>
              <div className="flex gap-3"><button type="button" className={btnQuiet} onClick={() => { setDraft({ id: u.id, title: u.title, body: u.body, pinned: u.pinned, publish: !!u.published_at, image_url: u.image_url ?? "" }); save.setMsg(null); }}>Edit</button><button type="button" className="text-sm font-semibold text-rose-700 hover:underline" onClick={() => remove(u)}>Delete</button></div>
            </li>
          ))}
        </ul>
      )}
      <Notice msg={del.msg} />
    </div>
  );
}
