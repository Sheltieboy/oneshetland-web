"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { saveAdvert } from "@/app/house-swaps/actions";
import {
  AREAS, FEATURES, ACCESS_FEATURE_IDS, LANDLORDS, LIMITS, PROPERTY_TYPES, CONTACT_RULE, HOUSE_SWAPS_DISCLAIMER, NEVER_PAY,
  advertPreview, bedroomsLabel, toggle, validateAdvert, type AdvertErrors, type AdvertForm,
} from "@/lib/house-swaps";
import { Chip, FeatureChips } from "./Chips";
import { WantLines } from "./ListingCard";
import { btnPrimary, fieldCls } from "./Shell";

const chip = "flex min-h-[44px] cursor-pointer items-center rounded-pill border border-line-strong bg-paper px-4 text-sm font-semibold text-ink transition has-[:checked]:border-navy has-[:checked]:bg-navy has-[:checked]:text-paper has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-navy has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50";
const stepBtn = "grid h-11 w-11 place-items-center rounded-full border border-line-strong bg-paper text-xl font-bold text-ink hover:bg-sand focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy disabled:opacity-40";

function Section({ id, title, hint, children }: { id: string; title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-card border border-line bg-paper p-5 shadow-soft sm:p-6">
      <h2 id={id} className="font-display text-2xl font-bold text-ink">{title}</h2>
      {hint && <p className="mt-1 text-sm text-ink-muted">{hint}</p>}
      <div className="mt-4 space-y-5">{children}</div>
    </section>
  );
}
const Err = ({ id, msg }: { id: string; msg?: string }) => (msg ? <p id={id} className="mt-1 text-sm font-semibold text-rose-800">{msg}</p> : null);

function Stepper({ label, value, onChange, nullable = false, min = 0, max = 8, anyLabel = "Any", describedBy }: {
  label: string; value: number | null; onChange: (v: number | null) => void; nullable?: boolean; min?: number; max?: number; anyLabel?: string; describedBy?: string;
}) {
  const text = value == null ? (nullable ? anyLabel : "Choose") : bedroomsLabel(value);
  return (
    <div role="group" aria-label={label} aria-describedby={describedBy} className="flex items-center gap-3">
      <button type="button" className={stepBtn} aria-label={`Fewer ${label.toLowerCase()}`} disabled={value == null || (!nullable && value <= min)} onClick={() => onChange(value == null ? null : value <= min ? (nullable ? null : min) : value - 1)}>{"−"}</button>
      <output aria-live="polite" className="min-w-[8.5rem] text-center text-lg font-bold text-ink">{text}</output>
      <button type="button" className={stepBtn} aria-label={`More ${label.toLowerCase()}`} disabled={value != null && value >= max} onClick={() => onChange(value == null ? min : value + 1)}>+</button>
    </div>
  );
}

function BedSelect({ id, label, value, onChange }: { id: string; label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-ink">{label}</label>
      <select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} className={fieldCls}>
        <option value="">Any</option>
        {Array.from({ length: 9 }, (_, i) => <option key={i} value={i}>{i === 0 ? "Studio / bedsit" : i}</option>)}
      </select>
    </div>
  );
}

/** Create or edit the member's advert: one friendly page in clear sections with a live preview. The server re-checks everything. */
export function MyAdvertForm({ initial, editing, photosSlot }: { initial: AdvertForm; editing: boolean; photosSlot?: ReactNode }) {
  const [f, setF] = useState<AdvertForm>(initial);
  const [errors, setErrors] = useState<AdvertErrors>({});
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const top = useRef<HTMLDivElement>(null);
  const set = <K extends keyof AdvertForm>(k: K, v: AdvertForm[K]) => setF((p) => ({ ...p, [k]: v }));
  const preview = advertPreview(f);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = validateAdvert(f);
    setErrors(v.errors);
    if (!v.ok) {
      setMsg({ tone: "error", text: "Please check the parts of the form marked in red." });
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid='true']")?.scrollIntoView({ block: "center", behavior: "smooth" }));
      return;
    }
    setMsg(null);
    start(async () => {
      const r = await saveAdvert(f);
      if (r.ok) {
        setMsg({ tone: "ok", text: editing ? "Saved. If you changed the wording, it will be checked again before it shows." : "Thank you. Your advert is saved and waiting for a quick check by our team. You'll see it here when it is live." });
        setF((p) => ({ ...p, acknowledged: false }));
        router.refresh();
        top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        if (r.fieldErrors) setErrors(r.fieldErrors);
        setMsg({ tone: "error", text: r.error });
      }
    });
  }

  const access = FEATURES.filter((x) => ACCESS_FEATURE_IDS.includes(x.id)), other = FEATURES.filter((x) => !ACCESS_FEATURE_IDS.includes(x.id));
  const featureChips = (name: "have_features" | "want_features", list: typeof FEATURES[number][]) => list.map((x) => (
    <label key={x.id} className={chip}><input type="checkbox" className="sr-only" checked={f[name].includes(x.id)} onChange={() => set(name, toggle(f[name], x.id))} />{x.label}</label>
  ));

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6" ref={top}>
        <div aria-live="polite" role="status">{msg?.tone === "ok" && <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">{msg.text}</p>}</div>
        <div role="alert">{msg?.tone === "error" && <p className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900">{msg.text}</p>}</div>

        <p className="rounded-xl bg-sand/70 px-4 py-3 text-sm text-ink-soft"><strong className="text-ink">Before you start:</strong> {CONTACT_RULE} Please don&apos;t give your address, your name or medical details. A broad area is all we need.</p>

        <Section id="s-home" title="Your home" hint="Tell people what you have. A broad area only: never an address.">
          <div>
            <label htmlFor="f-area" className="block text-sm font-semibold text-ink">Which part of Shetland is it in? <span className="text-rose-700">*</span></label>
            <select id="f-area" value={f.have_area_id} onChange={(e) => set("have_area_id", e.target.value)} aria-invalid={!!errors.have_area_id || undefined} aria-describedby="e-area" className={fieldCls}>
              <option value="">Choose an area</option>
              {AREAS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <Err id="e-area" msg={errors.have_area_id} />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink" id="l-beds">How many bedrooms? <span className="text-rose-700">*</span></p>
            <div className="mt-2"><Stepper label="Bedrooms" value={f.have_bedrooms} onChange={(v) => set("have_bedrooms", v)} describedBy="e-beds" /></div>
            <Err id="e-beds" msg={errors.have_bedrooms} />
          </div>
          <fieldset aria-describedby="e-type" aria-invalid={!!errors.have_type || undefined}>
            <legend className="text-sm font-semibold text-ink">What type of home is it? <span className="text-rose-700">*</span></legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {PROPERTY_TYPES.map((t) => <label key={t.id} className={chip}><input type="radio" name="have_type" className="sr-only" checked={f.have_type === t.id} onChange={() => set("have_type", t.id)} />{t.label}</label>)}
            </div>
            <Err id="e-type" msg={errors.have_type} />
          </fieldset>
          <fieldset>
            <legend className="text-sm font-semibold text-ink">Does it have any of these? (optional)</legend>
            <div className="mt-2 flex flex-wrap gap-2">{featureChips("have_features", access)}{featureChips("have_features", other)}</div>
          </fieldset>
          <div>
            <label htmlFor="f-landlord" className="block text-sm font-semibold text-ink">Who is your landlord? (optional)</label>
            <select id="f-landlord" value={f.landlord_type} onChange={(e) => set("landlord_type", e.target.value)} className={fieldCls}>
              <option value="">Prefer not to say</option>
              {LANDLORDS.filter((l) => l.id !== "prefer_not_to_say").map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </div>
        </Section>

        <Section id="s-want" title="What you're looking for" hint="Everything here is optional. The more open you are, the more adverts could suit you.">
          <fieldset aria-describedby="e-wantareas" aria-invalid={!!errors.want_area_ids || undefined}>
            <legend className="text-sm font-semibold text-ink">Where would you consider moving to?</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              <label className={chip}><input type="checkbox" className="sr-only" checked={f.anywhere} onChange={(e) => setF((p) => ({ ...p, anywhere: e.target.checked, want_area_ids: e.target.checked ? [] : p.want_area_ids }))} />Open to anywhere in Shetland</label>
              {AREAS.map((a) => <label key={a.id} className={chip}><input type="checkbox" className="sr-only" disabled={f.anywhere} checked={f.want_area_ids.includes(a.id)} onChange={() => set("want_area_ids", toggle(f.want_area_ids, a.id))} />{a.name}</label>)}
            </div>
            <Err id="e-wantareas" msg={errors.want_area_ids} />
          </fieldset>
          <div>
            <p className="text-sm font-semibold text-ink">How many bedrooms would you like?</p>
            <div className="mt-2 grid max-w-md grid-cols-2 gap-3">
              <BedSelect id="f-min" label="At least" value={f.want_min_bedrooms} onChange={(v) => set("want_min_bedrooms", v)} />
              <BedSelect id="f-max" label="No more than" value={f.want_max_bedrooms} onChange={(v) => set("want_max_bedrooms", v)} />
            </div>
            <div aria-live="polite"><Err id="e-wantbeds" msg={errors.want_bedrooms} /></div>
          </div>
          <fieldset>
            <legend className="text-sm font-semibold text-ink">Types of home you would consider</legend>
            <p className="text-sm text-ink-muted">Choose none if you are not fussy.</p>
            <div className="mt-2 flex flex-wrap gap-2">{PROPERTY_TYPES.map((t) => <label key={t.id} className={chip}><input type="checkbox" className="sr-only" checked={f.want_types.includes(t.id)} onChange={() => set("want_types", toggle(f.want_types, t.id))} />{t.label}</label>)}</div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-semibold text-ink">Features you need</legend>
            <div className="mt-2 flex flex-wrap gap-2">{featureChips("want_features", access)}{featureChips("want_features", other)}</div>
          </fieldset>
        </Section>

        <Section id="s-words" title="A few words (optional)" hint="A short headline and a few sentences. No phone numbers, emails or web links, and no medical details.">
          <div>
            <label htmlFor="f-headline" className="block text-sm font-semibold text-ink">Headline</label>
            <input id="f-headline" value={f.headline} maxLength={LIMITS.headline} onChange={(e) => set("headline", e.target.value)} aria-invalid={!!errors.headline || undefined} aria-describedby="e-headline h-headline" className={fieldCls} placeholder="For example: Two-bed flat in town, family needs more room" />
            <p id="h-headline" className="mt-1 text-xs text-ink-muted">{f.headline.length}/{LIMITS.headline}</p>
            <Err id="e-headline" msg={errors.headline} />
          </div>
          <div>
            <label htmlFor="f-desc" className="block text-sm font-semibold text-ink">About your home</label>
            <textarea id="f-desc" rows={4} value={f.description} maxLength={LIMITS.description} onChange={(e) => set("description", e.target.value)} aria-invalid={!!errors.description || undefined} aria-describedby="e-desc h-desc" className={fieldCls} />
            <p id="h-desc" className="mt-1 text-xs text-ink-muted">{f.description.length}/{LIMITS.description}</p>
            <Err id="e-desc" msg={errors.description} />
          </div>
          <div>
            <label htmlFor="f-notes" className="block text-sm font-semibold text-ink">Anything else you are looking for</label>
            <textarea id="f-notes" rows={3} value={f.want_notes} maxLength={LIMITS.notes} onChange={(e) => set("want_notes", e.target.value)} aria-invalid={!!errors.want_notes || undefined} aria-describedby="e-notes h-notes" className={fieldCls} />
            <p id="h-notes" className="mt-1 text-xs text-ink-muted">{f.want_notes.length}/{LIMITS.notes}</p>
            <Err id="e-notes" msg={errors.want_notes} />
          </div>
        </Section>

        {photosSlot}

        <Section id="s-ack" title="One last thing">
          <label className={"flex cursor-pointer items-start gap-3 rounded-xl border p-4 " + (errors.acknowledged ? "border-rose-400 bg-rose-50" : "border-line-strong bg-sand/40")}>
            <input type="checkbox" checked={f.acknowledged} onChange={(e) => set("acknowledged", e.target.checked)} aria-invalid={!!errors.acknowledged || undefined} aria-describedby="e-ack" className="mt-1 h-6 w-6 shrink-0 accent-[#032f4c]" />
            <span className="text-sm leading-relaxed text-ink">I understand that OneShetland only makes introductions, and that any swap needs both landlords&apos; written consent. <span className="block text-ink-muted">{HOUSE_SWAPS_DISCLAIMER}</span><span className="mt-2 block font-semibold text-ink">{NEVER_PAY}</span></span>
          </label>
          <Err id="e-ack" msg={errors.acknowledged} />
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Saving…" : editing ? "Save changes" : "Save my advert"}</button>
            <p className="text-sm text-ink-muted">{editing ? "Changing the headline, words or photos of a live advert sends it for a quick re-check." : "Our team checks every new advert before it appears."}</p>
          </div>
        </Section>
      </div>

      <aside aria-label="Preview of your advert" className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-card border border-dashed border-line-strong bg-paper p-5 shadow-soft">
          <p className="text-[11px] font-black uppercase tracking-widest text-navy-light">Preview: how your advert will read</p>
          <h3 className="mt-2 break-words font-display text-xl font-bold leading-snug text-ink">{preview.headline}</h3>
          <div className="mt-4 space-y-4">
            <div className="rounded-xl bg-sand/60 p-3.5">
              <p className="text-[11px] font-black uppercase tracking-widest text-ink-muted">What I have</p>
              <p className="mt-2 text-sm font-semibold text-ink">{preview.haveLine || "Choose an area, bedrooms and type"}</p>
              <div className="mt-2"><FeatureChips features={f.have_features} /></div>
              {f.landlord_type && <p className="mt-2"><Chip>{LANDLORDS.find((l) => l.id === f.landlord_type)?.label}</Chip></p>}
            </div>
            <div className="rounded-xl border border-line p-3.5">
              <p className="text-[11px] font-black uppercase tracking-widest text-ink-muted">What I&apos;m looking for</p>
              <div className="mt-2"><WantLines areas={preview.wantAreas} beds={preview.wantBeds} types={preview.wantTypes} features={f.want_features} /></div>
            </div>
            {f.description.trim() && <p className="whitespace-pre-line break-words text-sm text-ink-soft">{f.description}</p>}
          </div>
        </div>
      </aside>
    </form>
  );
}
