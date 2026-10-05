"use client";

import { useState } from "react";
import { savePageDraftAction } from "@/app/admin/launch-partners/actions";
import { Field, SaveBar, Section, inputCls, lines } from "./fields";
import { EMPHASES, EMPHASIS_LABEL, HERO_VISUALS, type Emphasis, type HeroVisualKind, type PageDraft } from "@/lib/business-page/types";
import type { PreviewConfig } from "@/lib/launch-preview/types";

/**
 * The prepared Business Page V2 — a private draft. It never changes the live listing. Representative items can be
 * copied across from the Launch Preview; they stay examples until the business adds real content.
 */
export function PageDraftEditor({ id, initial, preview, previewHref }: { id: string; initial: PageDraft; preview: PreviewConfig; previewHref: string }) {
  const [d, setD] = useState<PageDraft>(() => structuredClone(initial));
  const [storyText, setStoryText] = useState(d.story?.body.join("\n\n") ?? "");
  const [usefulText, setUsefulText] = useState((d.useful ?? []).map((u) => `${u.title}\n${u.body.join("\n")}`).join("\n\n---\n\n"));
  const setHero = (patch: Partial<PageDraft["hero"]>) => setD((p) => ({ ...p, hero: { ...p.hero, ...patch } }));

  function copyFromPreview() {
    setD((p) => ({
      ...p,
      products: preview.products.length ? preview.products.map((x) => ({ ...x })) : p.products,
      experience: preview.experience ? { ...preview.experience } : p.experience,
      booking: preview.booking ? { ...preview.booking } : p.booking,
    }));
  }

  async function save() {
    const next: PageDraft = { ...d };
    const body = lines(storyText);
    if (body.length && (next.story?.title ?? "").trim()) next.story = { eyebrow: next.story?.eyebrow, title: next.story!.title, body, source: next.story?.source };
    else delete next.story;
    const useful = usefulText.split(/\n\s*---\s*\n/).map((blk) => blk.trim().split("\n").map((x) => x.trim()).filter(Boolean)).filter((b) => b.length >= 2).map((b) => ({ title: b[0], body: b.slice(1) }));
    if (useful.length) next.useful = useful; else delete next.useful;
    if (next.rewards && !next.rewards.title.trim()) delete next.rewards;
    const r = await savePageDraftAction(id, next);
    return r.ok ? null : r.error;
  }

  return (
    <Section id="page" title="Business page" sub="A private draft of the real OneShetland business page (Business Page V2). The public listing does not change.">
      <div className="flex flex-wrap items-center gap-3">
        <a href={previewHref} target="_blank" rel="noopener noreferrer" className="rounded-pill border border-line-strong px-4 py-1.5 text-sm font-semibold text-ink-soft hover:bg-sand">Preview business page →</a>
        <button type="button" onClick={copyFromPreview} className="rounded-pill border border-line-strong px-4 py-1.5 text-sm font-semibold text-ink-soft hover:bg-sand">Copy example items from the preview</button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="What leads the page"><select className={inputCls} value={d.emphasis ?? ""} onChange={(e) => setD({ ...d, emphasis: (e.target.value || undefined) as Emphasis | undefined })}>
          <option value="">Decide automatically from the content</option>
          {EMPHASES.map((e) => <option key={e} value={e}>{EMPHASIS_LABEL[e]}</option>)}
        </select></Field>
        <Field label="Headline" hint="defaults to the business name"><input className={inputCls} value={d.hero.headline ?? ""} onChange={(e) => setHero({ headline: e.target.value || undefined })} /></Field>
        <Field label="Label above the name" hint="e.g. Hand-made jewellery"><input className={inputCls} value={d.hero.eyebrow ?? ""} onChange={(e) => setHero({ eyebrow: e.target.value || undefined })} /></Field>
        <Field label="Place" hint="e.g. Weisdale, Shetland"><input className={inputCls} value={d.hero.locality ?? ""} onChange={(e) => setHero({ locality: e.target.value || undefined })} /></Field>
        <Field label="Hero picture"><select className={inputCls} value={d.hero.treatment ?? ""} onChange={(e) => setHero({ treatment: (e.target.value || undefined) as HeroVisualKind | undefined })}>
          <option value="">Decide automatically</option>
          {HERO_VISUALS.map((v) => <option key={v} value={v}>{v === "photo" ? "The photograph" : v === "mosaic" ? "A mosaic of product pictures" : "The branded card (no photograph)"}</option>)}
        </select></Field>
        <div className="sm:col-span-2"><Field label="Tagline"><input className={inputCls} value={d.hero.tagline} onChange={(e) => setHero({ tagline: e.target.value })} /></Field></div>
        <Field label="Lead picture address"><input className={inputCls} value={d.hero.image.src} onChange={(e) => setHero({ image: { ...d.hero.image, src: e.target.value } })} /></Field>
        <Field label="Picture description"><input className={inputCls} value={d.hero.image.alt} onChange={(e) => setHero({ image: { ...d.hero.image, alt: e.target.value } })} /></Field>
      </div>
      <details className="rounded-xl border border-line p-4" open={!!d.story}>
        <summary className="cursor-pointer text-sm font-bold text-ink">Story</summary>
        <div className="mt-3 grid gap-3">
          <Field label="Title"><input className={inputCls} value={d.story?.title ?? ""} onChange={(e) => setD({ ...d, story: { eyebrow: d.story?.eyebrow, title: e.target.value, body: d.story?.body ?? [], source: d.story?.source } })} /></Field>
          <Field label="Story" hint="blank line between paragraphs"><textarea className={inputCls} rows={5} value={storyText} onChange={(e) => setStoryText(e.target.value)} /></Field>
        </div>
      </details>
      <details className="rounded-xl border border-line p-4" open={!!d.rewards}>
        <summary className="cursor-pointer text-sm font-bold text-ink">Rewards / offers idea</summary>
        <div className="mt-3 grid gap-3">
          <Field label="Title"><input className={inputCls} value={d.rewards?.title ?? ""} onChange={(e) => setD({ ...d, rewards: { title: e.target.value, body: d.rewards?.body ?? "" } })} /></Field>
          <Field label="Idea" hint="worded as a possibility, never as something that exists"><textarea className={inputCls} rows={2} value={d.rewards?.body ?? ""} onChange={(e) => setD({ ...d, rewards: { title: d.rewards?.title ?? "", body: e.target.value } })} /></Field>
        </div>
      </details>
      <details className="rounded-xl border border-line p-4" open={!!d.useful?.length}>
        <summary className="cursor-pointer text-sm font-bold text-ink">Useful local information</summary>
        <div className="mt-3"><Field label="Blocks" hint="first line is the heading; separate blocks with a line containing only ---"><textarea className={inputCls + " font-mono"} rows={6} value={usefulText} onChange={(e) => setUsefulText(e.target.value)} /></Field></div>
      </details>
      <p className="text-xs text-ink-muted">Example items on the page: {d.products?.length ?? 0} product{(d.products?.length ?? 0) === 1 ? "" : "s"}{d.experience ? ", 1 experience" : ""}{d.booking ? ", a booking illustration" : ""}. They are replaced the moment the business adds real content.</p>
      <Field label="Notes for you" hint="never shown on the page"><textarea className={inputCls} rows={2} value={d.notes ?? ""} onChange={(e) => setD({ ...d, notes: e.target.value || undefined })} /></Field>
      <SaveBar onSave={save} label="Save business page" />
    </Section>
  );
}
