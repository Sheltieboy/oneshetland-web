"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteSponsor, saveSponsor } from "@/app/organise/actions";
import type { EditionSponsor } from "@/lib/editions/types";
import { sponsorFields } from "@/lib/editions/validate";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { SafeImage } from "@/components/ui/SafeImage";
import { EmptyState, Field, Notice, btnPrimary, btnQuiet, btnSecondary, inputCls } from "./kit";
import { useAction } from "./use-action";
import { ImageUpload } from "./ImageUpload";

type Draft = { id: string | null; name: string; level: string; logo_url: string; url: string; position: number };

export function SponsorsManager({ organiserSlug, editionSlug, organiserId, sponsors }: { organiserSlug: string; editionSlug: string; organiserId: string; sponsors: EditionSponsor[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const save = useAction();
  const del = useAction();
  const [draft, setDraft] = useState<Draft | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const v = sponsorFields(draft);
    if (!v.ok) return save.setMsg({ ok: false, text: v.error });
    save.run(() => saveSponsor(organiserSlug, editionSlug, draft.id, draft), { success: "Sponsor saved.", onOk: () => { setDraft(null); router.refresh(); } });
  }
  async function remove(s: EditionSponsor) {
    if (!(await confirm({ title: `Remove ${s.name}?`, body: "They are taken off the Edition page.", confirmLabel: "Remove sponsor", danger: true }))) return;
    del.run(() => deleteSponsor(organiserSlug, editionSlug, s.id), { onOk: () => router.refresh() });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-ink-soft">Thank the people and businesses who support this Edition. Sponsors are shown in this order, with an optional link to their website.</p>
        <button type="button" className={btnPrimary} onClick={() => { setDraft({ id: null, name: "", level: "", logo_url: "", url: "", position: sponsors.length }); save.setMsg(null); }}>Add sponsor</button>
      </div>
      {draft && (
        <form onSubmit={submit} className="space-y-4 rounded-card border border-line bg-paper p-5 shadow-soft" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="sp-name"><input id="sp-name" className={inputCls} value={draft.name} onChange={(e) => set("name", e.target.value)} maxLength={120} required /></Field>
            <Field label="Level" htmlFor="sp-level" hint="For example Gold, or Headline partner. Optional."><input id="sp-level" className={inputCls} value={draft.level} onChange={(e) => set("level", e.target.value)} maxLength={40} /></Field>
            <Field label="Website" htmlFor="sp-url" hint="Must start with https://"><input id="sp-url" className={inputCls} inputMode="url" value={draft.url} onChange={(e) => set("url", e.target.value)} placeholder="https://" /></Field>
            <Field label="Order" htmlFor="sp-pos" hint="Lower numbers come first."><input id="sp-pos" type="number" min={0} className={inputCls} value={draft.position} onChange={(e) => set("position", Number(e.target.value))} /></Field>
          </div>
          <ImageUpload label="Logo" organiserId={organiserId} kind="sponsor" value={draft.logo_url} onChange={(u) => set("logo_url", u)} />
          <Notice msg={save.msg} />
          <div className="flex gap-2.5"><button type="submit" disabled={save.pending} className={btnPrimary}>{save.pending ? "Saving…" : "Save sponsor"}</button><button type="button" className={btnSecondary} onClick={() => setDraft(null)}>Cancel</button></div>
        </form>
      )}
      {sponsors.length === 0 ? <EmptyState>No sponsors yet.</EmptyState> : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-paper">
          {sponsors.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-12 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-sand/50">{s.logo_url ? <SafeImage src={s.logo_url} alt="" className="h-full w-full object-contain" /> : <span className="text-xs text-ink-muted">No logo</span>}</div>
                <div className="min-w-0"><p className="truncate font-semibold text-ink">{s.name}</p><p className="truncate text-xs text-ink-muted">{[s.level, s.url].filter(Boolean).join(" · ")}</p></div>
              </div>
              <div className="flex gap-3"><button type="button" className={btnQuiet} onClick={() => { setDraft({ id: s.id, name: s.name, level: s.level ?? "", logo_url: s.logo_url ?? "", url: s.url ?? "", position: s.position }); save.setMsg(null); }}>Edit</button><button type="button" className="text-sm font-semibold text-rose-700 hover:underline" onClick={() => remove(s)}>Remove</button></div>
            </li>
          ))}
        </ul>
      )}
      <Notice msg={del.msg} />
    </div>
  );
}
