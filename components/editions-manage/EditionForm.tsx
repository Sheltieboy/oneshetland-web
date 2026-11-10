"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createEdition, updateEdition } from "@/app/organise/actions";
import { dateProblem, dateRangeLabel, slugify } from "@/lib/editions/rules";
import { KIND_LABEL, type Edition, type EditionKind, type Organiser } from "@/lib/editions/types";
import { normaliseFocus, resolveBrand } from "@/lib/editions/brand";
import { EDITION_KINDS, editionFields } from "@/lib/editions/validate";
import { MATERIAL_SAVED, MATERIAL_WARNING, materialChangesFor, materialSentence } from "@/lib/editions/journey";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { Field, Notice, btnPrimary, inputCls } from "./kit";
import { useAction } from "./use-action";
import { ImageUpload } from "./ImageUpload";
import { BrandPreview, BrandReport, ColourField, FocusPicker } from "./brand-kit";

const KIND_HINT: Record<EditionKind, string> = {
  single_day: "One day.", multi_day: "2 to 14 days.", week: "6 to 10 days.", season: "Up to 13 months.", campaign: "Up to 13 months.",
};

type Props = {
  mode: "create" | "edit"; organiserSlug: string; organiserId: string; series: { id: string; name: string }[];
  edition?: Edition; /** Pre-fill for "next year's Edition". */ seed?: Partial<Record<"title" | "kind" | "starts_on" | "ends_on" | "series_id" | "brand_color" | "summary", string>>;
  canCreateSeries: boolean; /** What this Edition inherits when it has no look of its own. */ organiser: Pick<Organiser, "name" | "brand_color" | "logo_url" | "cover_url" | "cover_focus">;
};

export function EditionForm({ mode, organiserSlug, organiserId, series, edition, seed, canCreateSeries, organiser }: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const { pending, msg, run, setMsg } = useAction();
  const [f, setF] = useState({
    title: edition?.title ?? seed?.title ?? "", slug: "", kind: (edition?.kind ?? seed?.kind ?? "single_day") as EditionKind,
    starts_on: edition?.starts_on ?? seed?.starts_on ?? "", ends_on: edition?.ends_on ?? seed?.ends_on ?? "",
    year_label: edition?.year_label ?? "", summary: edition?.summary ?? seed?.summary ?? "", description: edition?.description ?? "",
    brand_color: edition?.brand_color ?? seed?.brand_color ?? "", logo_url: edition?.logo_url ?? "", cover_url: edition?.cover_url ?? "", cover_focus: edition?.cover_focus ?? "",
    series_id: edition?.series_id ?? seed?.series_id ?? "", new_series_name: "",
  });
  const [slugTouched, setSlugTouched] = useState(false);
  const [seriesMode, setSeriesMode] = useState<"none" | "existing" | "new">(f.series_id ? "existing" : "none");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const v = e.target.value;
    setF((p) => {
      const next = { ...p, [k]: v };
      if (k === "title" && mode === "create" && !slugTouched) next.slug = slugify(v);
      if (k === "starts_on" && p.kind === "single_day") next.ends_on = v;
      if (k === "kind" && v === "single_day") next.ends_on = p.starts_on;
      return next;
    });
  };
  const live = f.starts_on && f.ends_on ? dateProblem(f.kind, f.starts_on, f.ends_on) : null;
  const look = resolveBrand({ brand_color: f.brand_color || null, logo_url: f.logo_url || null, cover_url: f.cover_url || null, cover_focus: f.cover_focus || null }, organiser);

  // An approved Edition goes back to review if its title, kind or dates change; anything else saves freely.
  const material = mode === "edit" && edition ? materialChangesFor(edition.review_state, edition, f) : [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...f, series_id: seriesMode === "existing" ? f.series_id : "", new_series_name: seriesMode === "new" ? f.new_series_name : "" };
    const v = editionFields(payload);
    if (!v.ok) return setMsg({ ok: false, text: v.error });
    if (mode === "create") run(() => createEdition(organiserSlug, payload), { onOk: (r) => router.push(`/organise/${organiserSlug}/editions/${r.edition}`) });
    else {
      if (material.length > 0 && !(await confirm({ title: "Send this Edition back for review?", body: `You changed ${materialSentence(material)}. ${MATERIAL_WARNING}`, confirmLabel: "Save and send back for review", danger: true }))) return;
      run(() => updateEdition(organiserSlug, edition!.slug, payload), { success: material.length > 0 ? MATERIAL_SAVED : "Details saved.", onOk: () => router.refresh() });
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <Field label="Title" htmlFor="e-title"><input id="e-title" className={inputCls} value={f.title} onChange={set("title")} maxLength={140} required /></Field>
      {mode === "create" ? (
        <Field label="Web address" htmlFor="e-slug" hint={<>Public page: <span className="font-semibold">oneshetland.com/editions/{f.slug || "your-edition"}</span>. It cannot be changed later.</>}>
          <input id="e-slug" className={inputCls} value={f.slug} onChange={(e) => { setSlugTouched(true); set("slug")(e); }} maxLength={80} autoCapitalize="none" spellCheck={false} />
        </Field>
      ) : (
        <p className="text-sm text-ink-muted">Web address: <span className="font-semibold text-ink">/editions/{edition!.slug}</span> (cannot be changed)</p>
      )}

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Kind" htmlFor="e-kind" hint={KIND_HINT[f.kind]}>
          <select id="e-kind" className={inputCls} value={f.kind} onChange={set("kind")}>{EDITION_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select>
        </Field>
        <Field label={f.kind === "single_day" ? "Date" : "Starts"} htmlFor="e-start"><input id="e-start" type="date" className={inputCls} value={f.starts_on} onChange={set("starts_on")} required /></Field>
        {f.kind !== "single_day" && <Field label="Ends" htmlFor="e-end"><input id="e-end" type="date" className={inputCls} value={f.ends_on} min={f.starts_on} onChange={set("ends_on")} required /></Field>}
      </div>
      {live && <p role="alert" className="-mt-3 text-sm font-medium text-rose-700">{live}</p>}

      <Field label="Summary" htmlFor="e-sum" hint={`${f.summary.length}/300. Appears in lists and search, and is required before you submit for review.`}>
        <textarea id="e-sum" className={inputCls} rows={2} value={f.summary} onChange={set("summary")} maxLength={300} />
      </Field>
      <Field label="Description" htmlFor="e-desc" hint="Optional longer introduction.">
        <textarea id="e-desc" className={inputCls} rows={5} value={f.description} onChange={set("description")} maxLength={8000} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Year label" htmlFor="e-year" hint="For example 2027. Optional."><input id="e-year" className={inputCls} value={f.year_label} onChange={set("year_label")} maxLength={20} /></Field>
      </div>

      <section aria-labelledby="e-look" className="rounded-card border border-line bg-sand/30 p-5">
        <h3 id="e-look" className="font-display text-lg font-bold text-ink">Look of this Edition</h3>
        <p className="mt-1 text-sm text-ink-soft">By default this Edition uses {organiser.name}&rsquo;s brand, so there is nothing to set up. Choose a different cover photograph, colour or logo only if this Edition should look different. Its title is the one above.</p>
        <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
          <div className="min-w-0 space-y-5">
            <ColourField value={f.brand_color} onChange={(hex) => setF((p) => ({ ...p, brand_color: hex }))} inherited={organiser.brand_color} hint={organiser.brand_color ? `Empty means ${organiser.name}'s colour (${organiser.brand_color}).` : `Empty means the OneShetland default. Set a colour on the Brand page to use it everywhere.`} />
            <div>
              <ImageUpload label="Cover photograph for this Edition" organiserId={organiserId} kind="edition-cover" value={f.cover_url} onChange={(u) => setF((p) => ({ ...p, cover_url: u, cover_focus: "" }))} hint={organiser.cover_url ? "Empty means your organiser cover photograph." : "Empty means no photograph; the page uses a colour field."} />
              {f.cover_url && <FocusPicker src={f.cover_url} value={normaliseFocus(f.cover_focus)} onChange={(focus) => setF((p) => ({ ...p, cover_focus: focus }))} />}
            </div>
            <ImageUpload label="Logo for this Edition" organiserId={organiserId} kind="edition-logo" value={f.logo_url} onChange={(u) => setF((p) => ({ ...p, logo_url: u }))} hint={organiser.logo_url ? "Empty means your organiser logo." : "Empty means a monogram of your organiser name."} />
          </div>
          <div className="min-w-0 lg:sticky lg:top-6 lg:self-start">
            <p className="mb-2 text-sm font-semibold text-ink">How it looks</p>
            <BrandPreview name={organiser.name} title={f.title || "Your Edition"} eyebrow={KIND_LABEL[f.kind]} tagline={f.summary || null} logo={look.logo} cover={look.cover} focus={look.focus} color={look.color}
              dateLabel={f.starts_on && f.ends_on ? dateRangeLabel(f.starts_on, f.ends_on) : undefined} />
            <div className="mt-4"><BrandReport color={look.color} /></div>
          </div>
        </div>
      </section>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-ink">Series</legend>
        <p className="text-xs text-ink-muted">Group yearly editions of the same event so visitors can find the others.</p>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="radio" name="series" checked={seriesMode === "none"} onChange={() => setSeriesMode("none")} /> Not part of a series</label>
          {series.length > 0 && <label className="flex items-center gap-2"><input type="radio" name="series" checked={seriesMode === "existing"} onChange={() => setSeriesMode("existing")} /> Existing series</label>}
          {canCreateSeries && mode === "create" && <label className="flex items-center gap-2"><input type="radio" name="series" checked={seriesMode === "new"} onChange={() => setSeriesMode("new")} /> New series</label>}
        </div>
        {seriesMode === "existing" && (
          <select aria-label="Series" className={inputCls} value={f.series_id} onChange={set("series_id")}>
            <option value="">Choose a series</option>{series.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        {seriesMode === "new" && <input aria-label="New series name" className={inputCls} placeholder="Series name, for example the event's usual name" value={f.new_series_name} onChange={set("new_series_name")} maxLength={120} />}
      </fieldset>

      {material.length > 0 && (
        <p role="note" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950">You changed {materialSentence(material)}. {MATERIAL_WARNING}</p>
      )}
      <Notice msg={msg} />
      <button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Saving…" : mode === "create" ? "Create Edition" : "Save details"}</button>
    </form>
  );
}
