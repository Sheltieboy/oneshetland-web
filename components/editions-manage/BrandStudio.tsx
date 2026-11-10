"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateOrganiserProfile } from "@/app/organise/actions";
import type { Organiser } from "@/lib/editions/types";
import { normaliseFocus } from "@/lib/editions/brand";
import { organiserProfile } from "@/lib/editions/validate";
import { Field, Notice, btnPrimary, inputCls } from "./kit";
import { useAction } from "./use-action";
import { ImageUpload } from "./ImageUpload";
import { BrandPreview, BrandReport, ColourField, FocusPicker } from "./brand-kit";

/**
 * The organiser's brand, in four simple steps: logo, one colour, one cover photograph, name and tagline. A live preview shows the real public masthead as it will
 * look. Everything else (paper and ink tones, typeface, layout, contrast) is derived from these four. Saves through the same action as the profile, carrying the
 * rest of the profile (about, website, email) through untouched.
 */
export function BrandStudio({ organiser, canEdit, hubName = null, inherited = null }: { organiser: Organiser; canEdit: boolean; hubName?: string | null; inherited?: { logo: boolean; cover: boolean; color: boolean } | null }) {
  const via = (on: boolean | undefined, what: string) => (hubName && on ? <p className="mb-3 rounded-lg border border-line bg-cream/50 px-3 py-2 text-sm text-ink-soft">Right now your Editions use <strong className="font-semibold text-ink">{hubName}&rsquo;s {what}</strong>, read live from your profile. Choose your own below to give your Editions a look of their own.</p> : null);
  const { pending, msg, run, setMsg } = useAction();
  const router = useRouter();
  const [f, setF] = useState({ name: organiser.name, tagline: organiser.tagline ?? "", logo_url: organiser.logo_url ?? "", cover_url: organiser.cover_url ?? "", cover_focus: normaliseFocus(organiser.cover_focus), brand_color: organiser.brand_color ?? "" });
  const full = () => ({ ...f, description: organiser.description ?? "", website: organiser.website ?? "", contact_email: organiser.contact_email ?? "" });
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = organiserProfile(full());
    if (!v.ok) return setMsg({ ok: false, text: v.error });
    run(() => updateOrganiserProfile(organiser.slug, full()), { success: "Brand saved. Your public pages now use it.", onOk: () => router.refresh() });
  }
  const step = "flex items-center gap-3 font-display text-xl font-bold text-ink";
  const num = "grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy text-sm font-bold text-paper";
  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]" noValidate>
      <fieldset disabled={!canEdit} className="min-w-0 space-y-8">
        <section aria-labelledby="b1">
          <h2 id="b1" className={step}><span className={num} aria-hidden="true">1</span> Your logo</h2>
          <p className="mb-3 mt-1 text-sm text-ink-soft">Shown on a clean white plate, so a dark or coloured logo is never lost on a photograph. A transparent PNG or SVG-like image works best.</p>
          {via(inherited?.logo, "logo")}
          <ImageUpload label="Logo" organiserId={organiser.id} kind="organiser-logo" value={f.logo_url} onChange={(u) => setF((p) => ({ ...p, logo_url: u }))} hint="JPEG, PNG or WebP, up to 10 MB. Wide logos are fine." />
        </section>
        <section aria-labelledby="b2">
          <h2 id="b2" className={step}><span className={num} aria-hidden="true">2</span> One colour</h2>
          {via(inherited?.color, "colour")}
          <div className="mt-3"><ColourField value={f.brand_color} onChange={(hex) => setF((p) => ({ ...p, brand_color: hex }))} /></div>
        </section>
        <section aria-labelledby="b3">
          <h2 id="b3" className={step}><span className={num} aria-hidden="true">3</span> One strong cover photograph</h2>
          {via(inherited?.cover, "cover photograph")}
          <p className="mb-3 mt-1 text-sm text-ink-soft">The photograph does most of the work. Choose a landscape picture at least 2000 pixels wide, with people, place or produce rather than text.</p>
          <ImageUpload label="Cover photograph" organiserId={organiser.id} kind="organiser-cover" value={f.cover_url} onChange={(u) => setF((p) => ({ ...p, cover_url: u, cover_focus: "50% 50%" }))} hint="JPEG, PNG or WebP, up to 10 MB." />
          {f.cover_url && <FocusPicker src={f.cover_url} value={f.cover_focus} onChange={(focus) => setF((p) => ({ ...p, cover_focus: focus }))} />}
        </section>
        <section aria-labelledby="b4">
          <h2 id="b4" className={step}><span className={num} aria-hidden="true">4</span> Your name and introduction</h2>
          <div className="mt-3 space-y-4">
            <Field label="Organiser name" htmlFor="bs-name"><input id="bs-name" className={inputCls} value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} maxLength={120} required /></Field>
            <Field label="Tagline" htmlFor="bs-tag" hint={`${f.tagline.length}/160. One line that sits under your name. Optional.`}><input id="bs-tag" className={inputCls} value={f.tagline} onChange={(e) => setF((p) => ({ ...p, tagline: e.target.value }))} maxLength={160} /></Field>
          </div>
        </section>
        <div className="space-y-3">
          <Notice msg={msg} />
          {canEdit ? <button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Saving…" : "Save brand"}</button> : <p className="text-sm text-ink-muted">Only administrators and owners can change the brand.</p>}
          <p className="text-xs text-ink-muted">Each Edition can use its own cover and title without changing this: it inherits your brand unless you choose otherwise in its details.</p>
        </div>
      </fieldset>

      <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start" aria-label="Live preview">
        <h2 className="mb-2 font-display text-xl font-bold text-ink">How it looks</h2>
        <BrandPreview name={f.name} tagline={f.tagline || null} logo={f.logo_url || null} cover={f.cover_url || null} focus={f.cover_focus} color={f.brand_color || null} eyebrow="Organiser" />
        <div className="mt-5 rounded-card border border-line bg-paper p-4"><BrandReport color={f.brand_color || null} /></div>
      </aside>
    </form>
  );
}
