"use client";

import { useState } from "react";
import { savePreviewAction } from "@/app/admin/launch-partners/actions";
import { Field, SaveBar, Section, commaList, inputCls, lines } from "./fields";
import type { PreviewConfig, PreviewExperience, PreviewProduct, PreviewSource } from "@/lib/launch-preview/types";

const blankProduct = (): PreviewProduct => ({ id: `item-${Math.random().toString(36).slice(2, 8)}`, title: "", price: 0, image: "", blurb: "", source: "" });

/**
 * The Launch Preview, as structured controls. Representative items are typed in by hand WITH the public address they
 * came from — the app never fetches or scrapes another website. Saved to the campaign; nothing becomes public.
 */
export function PreviewEditor({ id, initial }: { id: string; initial: PreviewConfig }) {
  const [c, setC] = useState<PreviewConfig>(() => structuredClone(initial));
  const set = (patch: Partial<PreviewConfig>) => setC((p) => ({ ...p, ...patch }));
  const setBiz = (patch: Partial<PreviewConfig["business"]>) => setC((p) => ({ ...p, business: { ...p.business, ...patch } }));
  const setHero = (patch: Partial<PreviewConfig["hero"]>) => setC((p) => ({ ...p, hero: { ...p.hero, ...patch } }));
  const head = c.hero.headline ?? ["", "", ""];
  const [storyText, setStoryText] = useState(c.story?.body.join("\n\n") ?? "");

  const setProduct = (i: number, patch: Partial<PreviewProduct>) => set({ products: c.products.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const setSource = (i: number, patch: Partial<PreviewSource>) => set({ sources: c.sources.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  async function save() {
    const next: PreviewConfig = { ...c, ...(c.story ? { story: { ...c.story, body: lines(storyText) } } : {}) };
    // Drop empty optional blocks so the stored document stays clean.
    if (next.story && (!next.story.title[0] && !next.story.title[1] || next.story.body.length === 0)) delete next.story;
    if (next.experience && !next.experience.title) delete next.experience;
    if (next.booking && !next.booking.cta) delete next.booking;
    if (next.hero.headline && next.hero.headline.every((x) => !x.trim())) delete next.hero.headline;
    const r = await savePreviewAction(id, next);
    return r.ok ? null : r.error;
  }

  const exp = c.experience;
  const setExp = (patch: Partial<PreviewExperience>) => set({ experience: { ...(exp ?? { title: "", blurb: "", image: { src: "", alt: "" }, source: "" }), ...patch } });

  return (
    <Section id="preview" title="Preview" sub="What the private /launch page says. Only people with the invitation will see it; nothing is live.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Headline — line 1"><input className={inputCls} value={head[0]} placeholder="Your products." onChange={(e) => setHero({ headline: [e.target.value, head[1], head[2]] })} /></Field>
        <Field label="Headline — line 2"><input className={inputCls} value={head[1]} placeholder="Your story." onChange={(e) => setHero({ headline: [head[0], e.target.value, head[2]] })} /></Field>
        <Field label="Headline — line 3 (accent)"><input className={inputCls} value={head[2]} placeholder="Discoverable across Shetland." onChange={(e) => setHero({ headline: [head[0], head[1], e.target.value] })} /></Field>
        <Field label="Search example" hint="the word shown in the 'search' picture"><input className={inputCls} value={c.searchTerm} onChange={(e) => set({ searchTerm: e.target.value })} /></Field>
      </div>
      <Field label="Introduction"><textarea className={inputCls} rows={3} value={c.hero.support} onChange={(e) => setHero({ support: e.target.value })} /></Field>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-1 text-sm font-bold text-ink">The business</legend>
        <Field label="Category line"><input className={inputCls} value={c.business.categoryLabel} onChange={(e) => setBiz({ categoryLabel: e.target.value })} /></Field>
        <Field label="Locality"><input className={inputCls} value={c.business.locality} onChange={(e) => setBiz({ locality: e.target.value })} /></Field>
        <div className="sm:col-span-2"><Field label="Description"><textarea className={inputCls} rows={3} value={c.business.description} onChange={(e) => setBiz({ description: e.target.value })} /></Field></div>
        <div className="sm:col-span-2"><Field label="Tags" hint="comma-separated"><input className={inputCls} value={c.business.tags.join(", ")} onChange={(e) => setBiz({ tags: commaList(e.target.value) })} /></Field></div>
        <Field label="Photo address" hint="https or one of our /launch/… files"><input className={inputCls} value={c.business.image.src} onChange={(e) => setBiz({ image: { ...c.business.image, src: e.target.value } })} /></Field>
        <Field label="Photo description (alt text)"><input className={inputCls} value={c.business.image.alt} onChange={(e) => setBiz({ image: { ...c.business.image, alt: e.target.value } })} /></Field>
        <Field label="Hero treatment"><select className={inputCls} value={c.hero.treatment ?? "photo"} onChange={(e) => setHero({ treatment: e.target.value as "photo" | "ambient" })}><option value="photo">Photo</option><option value="ambient">Ambient (for a business without a strong photograph)</option></select></Field>
        <Field label="Category"><select className={inputCls} value={c.business.category ?? "retail"} onChange={(e) => setBiz({ category: e.target.value as "retail" | "food_drink" | "services" })}><option value="retail">Retail</option><option value="food_drink">Food & drink</option><option value="services">Services</option></select></Field>
      </fieldset>

      <details className="rounded-xl border border-line p-4" open={c.products.length > 0}>
        <summary className="cursor-pointer text-sm font-bold text-ink">Example products ({c.products.length}/6)</summary>
        <p className="mt-2 text-xs text-ink-muted">Representative items already shown publicly on the business&rsquo;s own site. Type each in with the page it came from. They are pictures, never products on OneShetland.</p>
        <div className="mt-3 space-y-3">
          {c.products.map((p, i) => (
            <div key={p.id} className="grid gap-2 rounded-xl bg-cream/60 p-3 sm:grid-cols-6">
              <input aria-label={`Product ${i + 1} title`} placeholder="Title" className={inputCls + " sm:col-span-3"} value={p.title} onChange={(e) => setProduct(i, { title: e.target.value })} />
              <input aria-label={`Product ${i + 1} price`} placeholder="Price £" inputMode="decimal" className={inputCls + " sm:col-span-1"} value={p.price || ""} onChange={(e) => setProduct(i, { price: Number(e.target.value) || 0 })} />
              <button type="button" onClick={() => set({ products: c.products.filter((_, j) => j !== i) })} className="self-end rounded-pill border border-line-strong px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 sm:col-span-2">Remove</button>
              <input aria-label={`Product ${i + 1} image address`} placeholder="Picture address (https)" className={inputCls + " sm:col-span-3"} value={p.image} onChange={(e) => setProduct(i, { image: e.target.value })} />
              <input aria-label={`Product ${i + 1} source page`} placeholder="Source page on their site (https)" className={inputCls + " sm:col-span-3"} value={p.source ?? ""} onChange={(e) => setProduct(i, { source: e.target.value })} />
              <input aria-label={`Product ${i + 1} description`} placeholder="One honest line about it" className={inputCls + " sm:col-span-6"} value={p.blurb} onChange={(e) => setProduct(i, { blurb: e.target.value })} />
            </div>
          ))}
          {c.products.length < 6 && <button type="button" onClick={() => set({ products: [...c.products, blankProduct()] })} className="rounded-pill border border-line-strong px-4 py-1.5 text-sm font-semibold text-ink-soft hover:bg-sand">+ Add an example product</button>}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Main site label"><input className={inputCls} value={c.sourceSite.label} onChange={(e) => set({ sourceSite: { ...c.sourceSite, label: e.target.value } })} /></Field>
          <Field label="Main site address"><input className={inputCls} value={c.sourceSite.url} onChange={(e) => set({ sourceSite: { ...c.sourceSite, url: e.target.value } })} /></Field>
        </div>
        <div className="mt-3"><Field label="Note under the products" hint="optional"><input className={inputCls} value={c.productsNote ?? ""} onChange={(e) => set({ productsNote: e.target.value || undefined })} /></Field></div>
      </details>

      <details className="rounded-xl border border-line p-4" open={!!c.story}>
        <summary className="cursor-pointer text-sm font-bold text-ink">Story (optional)</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Small heading"><input className={inputCls} value={c.story?.eyebrow ?? ""} onChange={(e) => set({ story: { eyebrow: e.target.value, title: c.story?.title ?? ["", ""], body: c.story?.body ?? [], source: c.story?.source ?? "" } })} /></Field>
          <Field label="Source address"><input className={inputCls} value={c.story?.source ?? ""} onChange={(e) => set({ story: { eyebrow: c.story?.eyebrow ?? "", title: c.story?.title ?? ["", ""], body: c.story?.body ?? [], source: e.target.value } })} /></Field>
          <Field label="Title"><input className={inputCls} value={c.story?.title[0] ?? ""} onChange={(e) => set({ story: { eyebrow: c.story?.eyebrow ?? "", title: [e.target.value, c.story?.title[1] ?? ""], body: c.story?.body ?? [], source: c.story?.source ?? "" } })} /></Field>
          <Field label="Title (accent)"><input className={inputCls} value={c.story?.title[1] ?? ""} onChange={(e) => set({ story: { eyebrow: c.story?.eyebrow ?? "", title: [c.story?.title[0] ?? "", e.target.value], body: c.story?.body ?? [], source: c.story?.source ?? "" } })} /></Field>
        </div>
        <div className="mt-3"><Field label="Story" hint="blank line between paragraphs — only what their own public material supports"><textarea className={inputCls} rows={5} value={storyText} onChange={(e) => { setStoryText(e.target.value); if (!c.story) set({ story: { eyebrow: "", title: ["", ""], body: [], source: "" } }); }} /></Field></div>
      </details>

      <details className="rounded-xl border border-line p-4" open={!!exp}>
        <summary className="cursor-pointer text-sm font-bold text-ink">Experience (optional)</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Title"><input className={inputCls} value={exp?.title ?? ""} onChange={(e) => setExp({ title: e.target.value })} /></Field>
          <Field label="Source address"><input className={inputCls} value={exp?.source ?? ""} onChange={(e) => setExp({ source: e.target.value })} /></Field>
          <Field label="Facts as they state them" hint="e.g. Tuesdays & Thursdays, 11am"><input className={inputCls} value={exp?.meta ?? ""} onChange={(e) => setExp({ meta: e.target.value || undefined })} /></Field>
          <Field label="Price as they state it"><input className={inputCls} value={exp?.price ?? ""} onChange={(e) => setExp({ price: e.target.value || undefined })} /></Field>
          <Field label="Photo address"><input className={inputCls} value={exp?.image.src ?? ""} onChange={(e) => setExp({ image: { src: e.target.value, alt: exp?.image.alt ?? "" } })} /></Field>
          <Field label="Photo description"><input className={inputCls} value={exp?.image.alt ?? ""} onChange={(e) => setExp({ image: { src: exp?.image.src ?? "", alt: e.target.value } })} /></Field>
        </div>
        <div className="mt-3"><Field label="Blurb"><textarea className={inputCls} rows={3} value={exp?.blurb ?? ""} onChange={(e) => setExp({ blurb: e.target.value })} /></Field></div>
      </details>

      <details className="rounded-xl border border-line p-4" open={!!c.booking}>
        <summary className="cursor-pointer text-sm font-bold text-ink">Booking illustration (optional — only if they really take bookings elsewhere)</summary>
        <div className="mt-3 grid gap-3">
          <Field label="Button line"><input className={inputCls} value={c.booking?.cta ?? ""} onChange={(e) => set({ booking: { cta: e.target.value, line: c.booking?.line ?? "" } })} /></Field>
          <Field label="Explanation"><textarea className={inputCls} rows={2} value={c.booking?.line ?? ""} onChange={(e) => set({ booking: { cta: c.booking?.cta ?? "", line: e.target.value } })} /></Field>
        </div>
      </details>

      <details className="rounded-xl border border-line p-4">
        <summary className="cursor-pointer text-sm font-bold text-ink">Sources ({c.sources.length}) — every outside fact traces to one</summary>
        <div className="mt-3 space-y-2">
          {c.sources.map((s, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-6">
              <input aria-label={`Source ${i + 1} label`} placeholder="Label" className={inputCls + " sm:col-span-2"} value={s.label} onChange={(e) => setSource(i, { label: e.target.value })} />
              <input aria-label={`Source ${i + 1} address`} placeholder="Address (https)" className={inputCls + " sm:col-span-2"} value={s.url} onChange={(e) => setSource(i, { url: e.target.value })} />
              <input aria-label={`Source ${i + 1} used for`} placeholder="Used for" className={inputCls + " sm:col-span-1"} value={s.used} onChange={(e) => setSource(i, { used: e.target.value })} />
              <button type="button" onClick={() => set({ sources: c.sources.filter((_, j) => j !== i) })} className="self-end rounded-pill border border-line-strong px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50">Remove</button>
            </div>
          ))}
          <button type="button" onClick={() => set({ sources: [...c.sources, { label: "", url: "", used: "" }] })} className="rounded-pill border border-line-strong px-4 py-1.5 text-sm font-semibold text-ink-soft hover:bg-sand">+ Add a source</button>
        </div>
      </details>

      <SaveBar onSave={save} label="Save preview" />
    </Section>
  );
}
