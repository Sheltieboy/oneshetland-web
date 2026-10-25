"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createAction, quoteAction } from "@/app/fetch/actions";
import type { Quote, Region, Size } from "@/lib/fetch-api";
import { STEPS, createInput, newKey, stepProblems, type Draft } from "@/lib/fetch/flow";
import { SIZE, TIMING, moneyLines, pounds } from "@/lib/fetch/present";
import { FETCH_ACCENT, MoneyTable, Notice, btnPrimary, btnSecondary, field, label } from "@/components/fetch/v2/ui";

/**
 * Asking for a Fetch, one question at a time: collection → delivery → the item → timing → price & review → post.
 * The price comes only from the server's quote. Posting carries one key for this draft, so a retry is the same Fetch, never two.
 */
export function RequestWizard({ regions, categories, initial }: {
  regions: Region[]; categories: { slug: string; name: string }[];
  initial?: { draft?: Draft; step?: number; quote?: Quote };
}) {
  const router = useRouter();
  const [d, setD] = useState<Draft>(initial?.draft ?? { pickup: {}, destination: {}, scheduling_mode: "flexible" });
  const [step, setStep] = useState(initial?.step ?? 0);
  const [quote, setQuote] = useState<Quote | null>(initial?.quote ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [tried, setTried] = useState(false);
  const key = useRef(newKey());
  const problems = useMemo(() => stepProblems(step, d), [step, d]);
  const set = (patch: Partial<Draft>) => { setD((x) => ({ ...x, ...patch })); setQuote(null); setError(null); };
  const regionName = (id?: string) => regions.find((r) => r.id === id)?.name ?? "";
  const withArea = (address?: string, id?: string) => {
    const area = regionName(id);
    return address && area && !address.toLowerCase().includes(area.toLowerCase()) ? `${address}, ${area}` : address ?? area;
  };
  const regionOptions = regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>);

  async function next() {
    setTried(true);
    if (problems.length) return;
    setTried(false);
    if (step === 3) {
      setBusy(true); setError(null);
      const r = await quoteAction({ size_class: d.size_class!, pickup: createInput(d, key.current).pickup, destination: createInput(d, key.current).destination }).catch(() => null);
      setBusy(false);
      if (!r) { setError({ message: "We couldn't reach OneShetland. Please try again." }); return; }
      if (!r.ok) {
        setError({ message: r.message, code: r.code });
        if (r.code === "location_unresolved" || r.code === "region_mismatch" || r.code === "outside_service_area") setStep(r.end === "destination" ? 1 : 0);
        return;
      }
      setQuote((r.data as { quote: Quote }).quote);
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function post() {
    setBusy(true); setError(null);
    const r = await createAction(createInput(d, key.current)).catch(() => null);
    setBusy(false);
    if (!r) { setError({ message: "We couldn't reach OneShetland. Your Fetch may not have been posted — press Post again; it won't be posted twice." }); return; }
    if (!r.ok) { setError({ message: r.message, code: r.code }); return; }
    router.push(`/fetch/requests/${r.data.request_id}?posted=1`);
  }

  const place = (which: "pickup" | "destination") => {
    const p = d[which];
    const up = (patch: Record<string, string>) => set({ [which]: { ...p, ...patch } } as Partial<Draft>);
    const word = which === "pickup" ? "collection" : "delivery";
    return (
      <div className="space-y-3">
        <label className={label}>Area
          <select value={p.region_id ?? ""} onChange={(e) => up({ region_id: e.target.value })} className={field} required>
            <option value="">Choose the area…</option>{regionOptions}
          </select>
        </label>
        <label className={label}>Address
          <input value={p.address ?? ""} onChange={(e) => up({ address: e.target.value })} className={field} autoComplete="street-address"
            placeholder={which === "pickup" ? "e.g. 7 Westerloch, Brae" : "e.g. 12 Hillhead, Lerwick"} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={label}>Postcode (helps us find it)
            <input value={p.postcode ?? ""} onChange={(e) => up({ postcode: e.target.value })} className={field} autoComplete="postal-code" placeholder="ZE1 0AA" />
          </label>
          <label className={label}>Village or district (optional)
            <input value={p.area ?? ""} onChange={(e) => up({ area: e.target.value })} className={field} />
          </label>
        </div>
        {which === "pickup" ? (
          <>
            <label className={label}>Name at the {word} (optional)
              <input value={d.pickup_name ?? ""} onChange={(e) => set({ pickup_name: e.target.value })} className={field} placeholder="e.g. the shop, or a person's name" />
            </label>
            <label className={label}>Anything the driver needs to know to collect it (optional)
              <textarea value={d.pickup_notes ?? ""} onChange={(e) => set({ pickup_notes: e.target.value })} rows={2} className={field} />
            </label>
          </>
        ) : (
          <label className={label}>Anything the driver needs to know to deliver it (optional)
            <textarea value={d.delivery_notes ?? ""} onChange={(e) => set({ delivery_notes: e.target.value })} rows={2} className={field} />
          </label>
        )}
        <p className="text-xs text-ink-muted">Only the driver who accepts your Fetch sees the exact address and notes. Other drivers just see the area.</p>
      </div>
    );
  };

  const money = quote ? moneyLines(quote) : null;

  return (
    <div className="space-y-4">
      <ol aria-label="Steps" className="flex flex-wrap gap-2 text-xs">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined}
            className={`rounded-pill px-3 py-1 font-semibold ${i === step ? "text-white" : i < step ? "bg-emerald-100 text-emerald-800" : "bg-sand text-ink-muted"}`}
            style={i === step ? { background: FETCH_ACCENT } : undefined}>{i < step ? "✓ " : ""}{i + 1}. {s}</li>
        ))}
      </ol>

      <section aria-labelledby="wiz-h" className="rounded-card border border-line bg-paper p-5 shadow-soft">
        <h2 id="wiz-h" className="mb-3 font-display text-xl font-bold text-ink">
          {["Where is it being collected?", "Where does it need to go?", "What are we fetching?", "When do you need it?", "Your price"][step]}
        </h2>

        {step === 0 && place("pickup")}
        {step === 1 && place("destination")}

        {step === 2 && (
          <div className="space-y-4">
            <label className={label}>What kind of item is it?
              <select value={d.category_slug ?? ""} onChange={(e) => set({ category_slug: e.target.value })} className={field}>
                <option value="">Choose…</option>{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
            </label>
            <label className={label}>Describe it
              <input value={d.item_description ?? ""} onChange={(e) => set({ item_description: e.target.value })} maxLength={140} className={field} placeholder="e.g. Two boxes of books" />
              <span className="mt-1 block text-xs font-normal text-ink-muted">Drivers see this before accepting. Please don&apos;t include names, phone numbers or addresses.</span>
            </label>
            <fieldset>
              <legend className={label}>How big is it?</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {(Object.keys(SIZE) as Size[]).map((s) => (
                  <label key={s} className={`flex cursor-pointer gap-2 rounded-card border p-3 text-sm ${d.size_class === s ? "border-[#e0722a] bg-orange-50" : "border-line"}`}>
                    <input type="radio" name="size" value={s} checked={d.size_class === s} onChange={() => set({ size_class: s })} className="mt-1" />
                    <span><b className="text-ink">{SIZE[s].label}</b><span className="block text-ink-soft">{SIZE[s].hint}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>
            {(d.size_class === "large" || d.size_class === "bulky") && (
              <fieldset className="rounded-card border border-line p-3">
                <legend className="px-1 text-sm font-semibold text-ink">Rough measurements in cm — so the driver can make sure it will fit</legend>
                <div className="grid grid-cols-3 gap-2">
                  {(["l", "w", "h"] as const).map((k) => (
                    <label key={k} className="text-xs text-ink-soft">{{ l: "Length", w: "Width", h: "Height" }[k]}
                      <input inputMode="numeric" value={d.dims?.[k] ?? ""} onChange={(e) => set({ dims: { ...d.dims, [k]: e.target.value } })} className={field} />
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <label className="flex items-start gap-2 text-sm text-ink"><input type="checkbox" checked={!!d.two_person} onChange={(e) => set({ two_person: e.target.checked })} className="mt-1" />It needs two people to lift</label>
            <label className="flex items-start gap-2 text-sm text-ink"><input type="checkbox" checked={!!d.fragile} onChange={(e) => set({ fragile: e.target.checked })} className="mt-1" />It&apos;s fragile</label>
            {(d.category_slug === "pharmacy" || d.category_slug === "takeaway") && (
              <label className="flex items-start gap-2 rounded-card border border-amber-300 bg-amber-50 p-3 text-sm text-ink">
                <input type="checkbox" checked={!!d.liability_acknowledged} onChange={(e) => set({ liability_acknowledged: e.target.checked })} className="mt-1" />
                I understand the driver is a member of the community, not a pharmacist or a food business, and only carries the sealed item.
              </label>
            )}
            {d.size_class === "bulky" && <Notice>Bulky items need a photo before a driver can accept — you can add it as soon as your Fetch is posted.</Notice>}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <fieldset>
              <legend className={label}>When do you need it?</legend>
              <div className="mt-2 space-y-2">
                {(["asap", "by", "flexible"] as const).map((m) => (
                  <label key={m} className={`flex cursor-pointer gap-2 rounded-card border p-3 text-sm ${d.scheduling_mode === m ? "border-[#e0722a] bg-orange-50" : "border-line"}`}>
                    <input type="radio" name="timing" checked={d.scheduling_mode === m} onChange={() => set({ scheduling_mode: m })} className="mt-1" />
                    <span><b className="text-ink">{TIMING[m].label}</b><span className="block text-ink-soft">{TIMING[m].hint}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>
            {d.scheduling_mode === "by" && <label className={label}>Needed by<input type="datetime-local" value={d.needed_by ?? ""} onChange={(e) => set({ needed_by: e.target.value })} className={field} /></label>}
            {d.scheduling_mode === "flexible" && <label className={label}>Any time before<input type="datetime-local" value={d.flexible_until ?? ""} onChange={(e) => set({ flexible_until: e.target.value })} className={field} /></label>}
            <label className={label}>Your phone number
              <input type="tel" value={d.contact_phone ?? ""} onChange={(e) => set({ contact_phone: e.target.value })} className={field} autoComplete="tel" />
            </label>
            <label className="flex items-start gap-2 text-sm text-ink"><input type="checkbox" checked={!!d.share_phone_with_driver} onChange={(e) => set({ share_phone_with_driver: e.target.checked })} className="mt-1" />
              Let my driver see this number while they have my Fetch (otherwise you&apos;ll message through OneShetland)</label>
            <label className="flex items-start gap-2 text-sm text-ink"><input type="checkbox" checked={!!d.safe_place_allowed} onChange={(e) => set({ safe_place_allowed: e.target.checked })} className="mt-1" />
              If nobody&apos;s in, the driver may leave it somewhere safe (they&apos;ll take a photo)</label>
            {d.safe_place_allowed && <label className={label}>Where? (optional)<input value={d.safe_place_note ?? ""} onChange={(e) => set({ safe_place_note: e.target.value })} className={field} placeholder="e.g. the porch" /></label>}
          </div>
        )}

        {step === 4 && money && quote && (
          <div className="space-y-4">
            <dl className="grid gap-2 rounded-card bg-sand/40 p-3 text-sm sm:grid-cols-2">
              <div><dt className="text-ink-muted">From</dt><dd className="text-ink">{withArea(d.pickup.address, d.pickup.region_id)}</dd></div>
              <div><dt className="text-ink-muted">To</dt><dd className="text-ink">{withArea(d.destination.address, d.destination.region_id)}</dd></div>
              <div><dt className="text-ink-muted">What</dt><dd className="text-ink">{d.item_description} · {d.size_class ? SIZE[d.size_class].label : ""}{d.two_person ? " · two-person lift" : ""}</dd></div>
              <div><dt className="text-ink-muted">When</dt><dd className="text-ink">{d.scheduling_mode ? TIMING[d.scheduling_mode].label : ""}</dd></div>
            </dl>
            <MoneyTable lines={money.lines} total={money.total} />
            {quote.minimum_applied && <p className="text-xs text-ink-muted">This includes Fetch&apos;s minimum driver payment for a short trip.</p>}
            {money.hold !== null && (
              <div className="rounded-card border border-line bg-sand/40 p-3 text-sm">
                <p className="text-ink">Expected charge if everything goes normally: <b>{pounds(money.total)}</b></p>
                <p className="text-ink">Temporary card authorisation: <b>up to {pounds(money.hold)}</b></p>
                <p className="mt-1 text-ink-soft">{money.holdNote}</p>
              </div>
            )}
            <p className="text-sm text-ink-soft">Nothing is charged now. When a driver accepts, your saved card is authorised; you&apos;re charged when your item is delivered.</p>
          </div>
        )}

        {error && <div className="mt-3"><Notice tone="error">{error.message}{error.code === "payment_method_required" && <> <Link href="/account/payments" className="font-semibold underline">Add a card</Link></>}</Notice></div>}
        {tried && problems.length > 0 && <div className="mt-3"><Notice tone="warn"><ul className="list-disc pl-4">{problems.map((p) => <li key={p}>{p}</li>)}</ul></Notice></div>}

        <div className="mt-5 flex flex-wrap justify-between gap-2">
          <button type="button" onClick={() => { setStep((s) => Math.max(s - 1, 0)); setError(null); }} disabled={step === 0 || busy} className={btnSecondary}>Back</button>
          {step < 4
            ? <button type="button" onClick={next} disabled={busy} className={btnPrimary} style={{ background: FETCH_ACCENT }}>{busy ? "Working out your price…" : step === 3 ? "See the price" : "Next"}</button>
            : <button type="button" onClick={post} disabled={busy || !quote} className={btnPrimary} style={{ background: FETCH_ACCENT }}>{busy ? "Posting…" : "Post Fetch"}</button>}
        </div>
      </section>
    </div>
  );
}
