"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { saveAdvert } from "@/app/house-swaps/actions";
import {
  FEATURES, ACCESS_FEATURE_IDS, LANDLORDS, LIMITS, PROPERTY_TYPES, CONTACT_RULE, HOUSE_SWAPS_DISCLAIMER, NEVER_PAY,
  advertPreview, bedroomsLabel, toggle, validateAdvert, type AdvertErrors, type AdvertForm,
} from "@/lib/house-swaps";
import { WIZARD_STEPS, clampStep, firstStepWithError, validateStep, type WizardStep } from "@/lib/house-swaps-wizard";
import { Chip, FeatureChips } from "./Chips";
import { WantLines } from "./ListingCard";
import { LocationPicker } from "./LocationPicker";
import { btnPrimary, btnSecondary, fieldCls } from "./Shell";

const chip = "flex min-h-[44px] cursor-pointer items-center rounded-pill border border-line-strong bg-paper px-4 text-sm font-semibold text-ink transition has-[:checked]:border-navy has-[:checked]:bg-navy has-[:checked]:text-paper has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-navy has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50";
const stepBtn = "grid h-11 w-11 place-items-center rounded-full border border-line-strong bg-paper text-xl font-bold text-ink hover:bg-sand focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy disabled:opacity-40";

/** One wizard step. `accent` carries the colour meaning: home = OS Blue, looking for = the existing teal, finish = neutral. */
function StepPanel({ id, title, hint, accent, badge, headingRef, children }: { id: string; title: string; hint?: ReactNode; accent: "home" | "want" | "none"; badge?: string; headingRef?: React.Ref<HTMLHeadingElement>; children: ReactNode }) {
  const bar = accent === "home" ? "border-l-[6px] border-l-navy" : accent === "want" ? "border-l-[6px] border-l-teal-dark" : "";
  const pill = accent === "home" ? "bg-navy text-paper" : "bg-teal/15 text-navy";
  return (
    <section aria-labelledby={id} className={`rounded-card border border-line bg-paper p-5 shadow-soft sm:p-7 ${bar}`}>
      {badge && <p className={`mb-2 inline-flex items-center rounded-pill px-3 py-1 text-[11px] font-black uppercase tracking-widest ${pill}`}>{badge}</p>}
      <h2 id={id} ref={headingRef} tabIndex={-1} className="font-display text-2xl font-bold text-ink focus:outline-none sm:text-3xl">{title}</h2>
      {hint && <p className="mt-1 text-base text-ink-soft">{hint}</p>}
      <div className="mt-6 space-y-7">{children}</div>
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

/** Progress through the three steps: colour (navy), shape (tick / number) and text, never colour alone. Finished steps are buttons that go back. */
function Progress({ step, canVisit, go }: { step: WizardStep; canVisit: (n: WizardStep) => boolean; go: (n: WizardStep) => void }) {
  return (
    <nav aria-label="Progress through the advert form">
      <ol className="flex items-start">
        {WIZARD_STEPS.map((st, i) => {
          const done = st.n < step, current = st.n === step, visit = !current && canVisit(st.n);
          const dot = `grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 text-base font-black ${current ? "border-navy bg-navy text-paper ring-4 ring-navy/15" : done ? "border-navy bg-paper text-navy" : "border-line-strong bg-paper text-ink-muted"}`;
          const inner = (
            <>
              <span className={dot} aria-hidden>{done ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="5 13 10 18 19 7" /></svg> : st.n}</span>
              <span className={`mt-1 block text-xs font-bold leading-tight sm:text-sm ${current ? "text-navy" : "text-ink-soft"}`}><span className="sr-only">Step {st.n}: </span>{st.short}{done && <span className="sr-only"> (done, go back)</span>}</span>
            </>
          );
          return (
            <li key={st.n} className={`flex min-w-0 flex-1 items-start ${i < 2 ? "" : "flex-none"}`}>
              {visit
                ? <button type="button" onClick={() => go(st.n)} className="flex min-h-[44px] flex-col items-center px-1 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy">{inner}</button>
                : <div aria-current={current ? "step" : undefined} className="flex min-h-[44px] flex-col items-center px-1 text-center">{inner}</div>}
              {i < 2 && <span aria-hidden className={`mt-5 h-1 min-w-4 flex-1 rounded-full ${done ? "bg-navy" : "bg-line"}`} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Create or edit the member's advert in three friendly steps with a live preview. Everything typed is kept when moving between steps. The server re-checks everything. */
export function MyAdvertForm({ initial, editing, photosSlot }: { initial: AdvertForm; editing: boolean; photosSlot?: ReactNode }) {
  const [f, setF] = useState<AdvertForm>(initial);
  const [step, setStep] = useState<WizardStep>(1);
  const [errors, setErrors] = useState<AdvertErrors>({});
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const top = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  const set = <K extends keyof AdvertForm>(k: K, v: AdvertForm[K]) => setF((p) => ({ ...p, [k]: v }));
  const preview = advertPreview(f);
  const info = WIZARD_STEPS[step - 1];

  // On every step change (not on first load) scroll to the top of the form and move focus to the step heading.
  useEffect(() => {
    if (!moved.current) return;
    top.current?.scrollIntoView({ block: "start" });
    heading.current?.focus({ preventScroll: true });
  }, [step]);
  const goTo = (n: WizardStep) => { moved.current = true; setMsg(null); setStep(n); };

  // Once someone has tried to continue, each red message clears as soon as that part is put right (it never adds new messages early).
  useEffect(() => {
    setErrors((prev) => {
      const keys = Object.keys(prev);
      if (!keys.length) return prev;
      const now = validateAdvert(f).errors as AdvertErrors;
      const kept: AdvertErrors = {};
      for (const k of keys) { const m = (now as Record<string, string | undefined>)[k]; if (m) (kept as Record<string, string>)[k] = m; }
      const same = Object.keys(kept).length === keys.length && keys.every((k) => (kept as Record<string, string>)[k] === (prev as Record<string, string>)[k]);
      return same ? prev : kept;
    });
  }, [f]);
  useEffect(() => {
    if (Object.keys(errors).length === 0) setMsg((m) => (m && m.tone === "error" && /marked in red|need another look/.test(m.text) ? null : m));
  }, [errors]);

  function next() {
    const v = validateStep(step, f);
    setErrors((p) => ({ ...p, ...v.errors }));
    if (!v.ok) {
      setMsg({ tone: "error", text: "Please check the parts of this step marked in red." });
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid='true']")?.scrollIntoView({ block: "center", behavior: "smooth" }));
      return;
    }
    setErrors({});
    goTo(clampStep(step + 1));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (step < 3) return next();
    const v = validateAdvert(f);
    setErrors(v.errors);
    if (!v.ok) {
      const s = firstStepWithError(v.errors) ?? 3;
      if (s !== step) { goTo(s); setMsg({ tone: "error", text: "A few things on an earlier step need another look. They are marked in red." }); }
      else {
        setMsg({ tone: "error", text: "Please check the parts of this step marked in red." });
        requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid='true']")?.scrollIntoView({ block: "center", behavior: "smooth" }));
      }
      return;
    }
    setMsg(null);
    start(async () => {
      const r = await saveAdvert(f);
      if (r.ok) {
        setMsg({ tone: "ok", text: editing ? "Saved. If you changed the wording, it will be checked again before it shows." : "Thank you. Your advert is saved and waiting for a quick check by our team. You'll see it here when it is live. You can add photos below." });
        setF((p) => ({ ...p, acknowledged: false }));
        router.refresh();
        top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        if (r.fieldErrors) { setErrors(r.fieldErrors); const s = firstStepWithError(r.fieldErrors); if (s && s !== step) goTo(s); }
        setMsg({ tone: "error", text: r.error });
      }
    });
  }

  const access = FEATURES.filter((x) => ACCESS_FEATURE_IDS.includes(x.id)), other = FEATURES.filter((x) => !ACCESS_FEATURE_IDS.includes(x.id));
  const featureChips = (name: "have_features" | "want_features", list: typeof FEATURES[number][]) => list.map((x) => (
    <label key={x.id} className={chip}><input type="checkbox" className="sr-only" checked={f[name].includes(x.id)} onChange={() => set(name, toggle(f[name], x.id))} />{x.label}</label>
  ));

  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-4xl space-y-6">
      <div ref={top} className="scroll-mt-24 space-y-5">
        <Progress step={step} canVisit={(n) => n < step || editing} go={goTo} />
        <div aria-live="polite" role="status">{msg?.tone === "ok" && <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">{msg.text}</p>}</div>
        <div role="alert">{msg?.tone === "error" && <p className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900">{msg.text}</p>}</div>
      </div>

      {step === 1 && (
        <StepPanel id="s-home" title={info.title} hint={info.hint} accent="home" badge="Step 1 of 3 · Your home" headingRef={heading}>
          <div>
            <p className="mb-3 text-base font-semibold text-ink">Where is it? <span className="text-rose-700" aria-hidden>*</span><span className="sr-only">(required)</span></p>
            <LocationPicker mode="home" value={{ regionId: f.have_area_id, placeId: f.have_place_id }} onChange={(v) => setF((p) => ({ ...p, have_area_id: v.regionId, have_place_id: v.placeId }))} describedBy="e-area" invalid={!!errors.have_area_id} />
            <Err id="e-area" msg={errors.have_area_id} />
          </div>
          <div>
            <p className="text-base font-semibold text-ink" id="l-beds">How many bedrooms? <span className="text-rose-700" aria-hidden>*</span><span className="sr-only">(required)</span></p>
            <div className="mt-2"><Stepper label="Bedrooms" value={f.have_bedrooms} onChange={(v) => set("have_bedrooms", v)} describedBy="e-beds" /></div>
            <Err id="e-beds" msg={errors.have_bedrooms} />
          </div>
          <fieldset aria-describedby="e-type" aria-invalid={!!errors.have_type || undefined}>
            <legend className="text-base font-semibold text-ink">What type of home is it? <span className="text-rose-700" aria-hidden>*</span><span className="sr-only">(required)</span></legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {PROPERTY_TYPES.map((t) => <label key={t.id} className={chip}><input type="radio" name="have_type" className="sr-only" checked={f.have_type === t.id} onChange={() => set("have_type", t.id)} />{t.label}</label>)}
            </div>
            <Err id="e-type" msg={errors.have_type} />
          </fieldset>
          <fieldset>
            <legend className="text-base font-semibold text-ink">Does it have any of these? <span className="font-normal text-ink-muted">(optional)</span></legend>
            <div className="mt-2 flex flex-wrap gap-2">{featureChips("have_features", access)}{featureChips("have_features", other)}</div>
          </fieldset>
          <div>
            <label htmlFor="f-landlord" className="block text-base font-semibold text-ink">Who is your landlord? <span className="font-normal text-ink-muted">(optional)</span></label>
            <select id="f-landlord" value={f.landlord_type} onChange={(e) => set("landlord_type", e.target.value)} className={`${fieldCls} sm:max-w-sm`}>
              <option value="">Prefer not to say</option>
              {LANDLORDS.filter((l) => l.id !== "prefer_not_to_say").map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </div>
        </StepPanel>
      )}

      {step === 2 && (
        <StepPanel id="s-want" title={info.title} hint={info.hint} accent="want" badge="Step 2 of 3 · Looking for" headingRef={heading}>
          <div>
            <p className="mb-3 text-base font-semibold text-ink">Where would you consider moving to?</p>
            <LocationPicker mode="wants" value={{ anywhere: f.anywhere, regionIds: f.want_area_ids, placeIds: f.want_place_ids }} onChange={(v) => setF((p) => ({ ...p, anywhere: v.anywhere, want_area_ids: v.regionIds, want_place_ids: v.placeIds }))} describedBy="e-wantareas" invalid={!!errors.want_area_ids} />
            <Err id="e-wantareas" msg={errors.want_area_ids} />
          </div>
          <div>
            <p className="text-base font-semibold text-ink">How many bedrooms would you like?</p>
            <div className="mt-2 grid max-w-md grid-cols-2 gap-3">
              <BedSelect id="f-min" label="At least" value={f.want_min_bedrooms} onChange={(v) => set("want_min_bedrooms", v)} />
              <BedSelect id="f-max" label="No more than" value={f.want_max_bedrooms} onChange={(v) => set("want_max_bedrooms", v)} />
            </div>
            <div aria-live="polite"><Err id="e-wantbeds" msg={errors.want_bedrooms} /></div>
          </div>
          <fieldset>
            <legend className="text-base font-semibold text-ink">Types of home you would consider</legend>
            <p className="text-sm text-ink-muted">Choose none if you are not fussy.</p>
            <div className="mt-2 flex flex-wrap gap-2">{PROPERTY_TYPES.map((t) => <label key={t.id} className={chip}><input type="checkbox" className="sr-only" checked={f.want_types.includes(t.id)} onChange={() => set("want_types", toggle(f.want_types, t.id))} />{t.label}</label>)}</div>
          </fieldset>
          <fieldset>
            <legend className="text-base font-semibold text-ink">Features you need <span className="font-normal text-ink-muted">(optional)</span></legend>
            <div className="mt-2 flex flex-wrap gap-2">{featureChips("want_features", access)}{featureChips("want_features", other)}</div>
          </fieldset>
        </StepPanel>
      )}

      {step === 3 && (
        <>
          <StepPanel id="s-words" title={info.title} hint={info.hint} accent="none" badge="Step 3 of 3 · Finish" headingRef={heading}>
            <p className="rounded-xl bg-sand/70 px-4 py-3 text-sm text-ink-soft"><strong className="text-ink">For the boxes below:</strong> {CONTACT_RULE} Please don&apos;t give your address, your name or medical details.</p>
            <div>
              <label htmlFor="f-headline" className="block text-base font-semibold text-ink">Headline <span className="font-normal text-ink-muted">(optional)</span></label>
              <input id="f-headline" value={f.headline} maxLength={LIMITS.headline} onChange={(e) => set("headline", e.target.value)} aria-invalid={!!errors.headline || undefined} aria-describedby="e-headline h-headline" className={fieldCls} placeholder="For example: Two-bed flat in town, family needs more room" />
              <p id="h-headline" className="mt-1 text-xs text-ink-muted">{f.headline.length}/{LIMITS.headline}</p>
              <Err id="e-headline" msg={errors.headline} />
            </div>
            <div>
              <label htmlFor="f-desc" className="block text-base font-semibold text-ink">About your home <span className="font-normal text-ink-muted">(optional)</span></label>
              <textarea id="f-desc" rows={4} value={f.description} maxLength={LIMITS.description} onChange={(e) => set("description", e.target.value)} aria-invalid={!!errors.description || undefined} aria-describedby="e-desc h-desc" className={fieldCls} />
              <p id="h-desc" className="mt-1 text-xs text-ink-muted">{f.description.length}/{LIMITS.description}</p>
              <Err id="e-desc" msg={errors.description} />
            </div>
            <div>
              <label htmlFor="f-notes" className="block text-base font-semibold text-ink">Anything else you are looking for <span className="font-normal text-ink-muted">(optional)</span></label>
              <textarea id="f-notes" rows={3} value={f.want_notes} maxLength={LIMITS.notes} onChange={(e) => set("want_notes", e.target.value)} aria-invalid={!!errors.want_notes || undefined} aria-describedby="e-notes h-notes" className={fieldCls} />
              <p id="h-notes" className="mt-1 text-xs text-ink-muted">{f.want_notes.length}/{LIMITS.notes}</p>
              <Err id="e-notes" msg={errors.want_notes} />
            </div>
          </StepPanel>

          {photosSlot}

          <aside aria-label="Preview of your advert" className="rounded-card border border-dashed border-line-strong bg-paper p-5 shadow-soft sm:p-6">
            <p className="text-[11px] font-black uppercase tracking-widest text-ink-muted">Preview: how your advert will read</p>
            <h3 className="mt-2 break-words font-display text-xl font-bold leading-snug text-ink">{preview.headline}</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border-l-4 border-l-navy bg-navy/5 p-3.5">
                <p className="text-[11px] font-black uppercase tracking-widest text-navy">Your home</p>
                <p className="mt-2 text-sm font-semibold text-ink">{preview.haveLine || "Choose an area, bedrooms and type"}</p>
                <div className="mt-2"><FeatureChips features={f.have_features} /></div>
                {f.landlord_type && <p className="mt-2"><Chip>{LANDLORDS.find((l) => l.id === f.landlord_type)?.label}</Chip></p>}
              </div>
              <div className="rounded-xl border-l-4 border-l-teal-dark bg-teal/10 p-3.5">
                <p className="text-[11px] font-black uppercase tracking-widest text-navy">Looking for</p>
                <div className="mt-2"><WantLines areas={preview.wantAreas} beds={preview.wantBeds} types={preview.wantTypes} features={f.want_features} /></div>
              </div>
            </div>
            {f.description.trim() && <p className="mt-4 whitespace-pre-line break-words text-sm text-ink-soft">{f.description}</p>}
          </aside>

          <section aria-labelledby="s-ack" className="rounded-card border border-line bg-paper p-5 shadow-soft sm:p-7">
            <h2 id="s-ack" className="font-display text-2xl font-bold text-ink">One last thing</h2>
            <div className="mt-4 space-y-4">
              <p className="rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm font-semibold leading-relaxed text-amber-950">{NEVER_PAY}</p>
              <label className={"flex cursor-pointer items-start gap-3 rounded-xl border p-4 " + (errors.acknowledged ? "border-rose-400 bg-rose-50" : "border-line-strong bg-sand/40")}>
                <input type="checkbox" checked={f.acknowledged} onChange={(e) => set("acknowledged", e.target.checked)} aria-invalid={!!errors.acknowledged || undefined} aria-describedby="e-ack" className="mt-1 h-6 w-6 shrink-0 accent-[#032f4c]" />
                <span className="text-sm leading-relaxed text-ink">I understand that OneShetland only makes introductions, and that any swap needs both landlords&apos; written consent.</span>
              </label>
              <Err id="e-ack" msg={errors.acknowledged} />
              <details className="group rounded-xl border border-teal/50 bg-teal/10 px-4 text-sm text-ink">
                <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 font-semibold [&::-webkit-details-marker]:hidden"><span>Staying safe</span><span aria-hidden className="text-xs underline group-open:hidden">Read</span><span aria-hidden className="hidden text-xs underline group-open:inline">Hide</span></summary>
                <p className="pb-3 leading-relaxed text-ink-soft">{HOUSE_SWAPS_DISCLAIMER}</p>
              </details>
            </div>
          </section>
        </>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {step > 1 && <button type="button" onClick={() => goTo(clampStep(step - 1))} className={`${btnSecondary} min-w-[7rem]`}>{"←"} Back</button>}
        {step < 3
          ? <button type="submit" className={`${btnPrimary} min-w-[8rem]`}>Next {"→"}</button>
          : <button type="submit" disabled={pending} className={`${btnPrimary} min-w-[10rem]`}>{pending ? "Saving…" : editing ? "Save changes" : "Save my advert"}</button>}
        {step === 3 && <p className="basis-full text-sm text-ink-muted sm:basis-auto">{editing ? "Changing the headline, words or photos of a live advert sends it for a quick re-check." : "Our team checks every new advert before it appears."}</p>}
      </div>
    </form>
  );
}
