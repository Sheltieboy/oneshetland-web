"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { applyAction, cancelRunAction, createRunAction, evidenceBeginAction, evidenceSubmitAction, evidenceViewAction, setVehicleAction } from "@/app/fetch/actions";
import { fetchMessage, type Region, type Run, type Size, type Verification } from "@/lib/fetch-api";
import { SIZE, VEHICLES, evidenceState, sizeLabel, when } from "@/lib/fetch/present";
import { uploadOne } from "@/components/fetch/v2/upload";
import { ActionDialog } from "@/components/fetch/v2/ActionDialog";
import { FETCH_ACCENT, Notice, btnPrimary, btnQuiet, field, label } from "@/components/fetch/v2/ui";

const SIZES = Object.keys(SIZE) as Size[];
const fits = (vehicle: string) => SIZES.slice(0, SIZES.indexOf(VEHICLES.find((v) => v.value === vehicle)?.maxSize ?? "small") + 1);
const NEEDS_REG = (v: string) => !["on_foot", "bicycle"].includes(v);

/** Applying to drive: vehicle, the largest size it takes, two-person lifting, registration, areas covered, a few words. Ends "Under review". */
export function ApplyForm({ regions }: { regions: Region[] }) {
  const router = useRouter();
  const [vehicle, setVehicle] = useState("");
  const [size, setSize] = useState<Size | "">("");
  const [two, setTwo] = useState(false);
  const [reg, setReg] = useState("");
  const [areas, setAreas] = useState<string[]>([]);
  const [statement, setStatement] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const sizes = useMemo(() => (vehicle ? fits(vehicle) : []), [vehicle]);
  const problems = [!vehicle && "Choose your vehicle.", !size && "Choose the largest size you can carry.",
    vehicle && NEEDS_REG(vehicle) && !reg.trim() && "Enter your vehicle registration.", areas.length > 20 && "Choose 20 areas at most."].filter(Boolean) as string[];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (problems.length) { setMsg({ ok: false, text: problems.join(" ") }); return; }
    setBusy(true); setMsg(null);
    const r = await applyAction({ vehicle_class: vehicle, max_size_class: size as Size, can_two_person_lift: two, vehicle_reg: reg.trim() || undefined, statement: statement.trim() || undefined }, areas).catch(() => null);
    setBusy(false);
    if (!r || !r.ok) { setMsg({ ok: false, text: r?.message ?? "We couldn't reach OneShetland. Please try again." }); return; }
    router.push("/fetch/driver/verification?applied=1");
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-card border border-line bg-paper p-5 shadow-soft">
      <label className={label}>Your vehicle
        <select value={vehicle} onChange={(e) => { setVehicle(e.target.value); setSize(""); }} className={field}>
          <option value="">Choose…</option>{VEHICLES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
        </select>
      </label>
      {vehicle && (
        <fieldset>
          <legend className={label}>The largest item you can carry</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {sizes.map((s) => (
              <label key={s} className={`flex cursor-pointer gap-2 rounded-card border p-3 text-sm ${size === s ? "border-[#e0722a] bg-orange-50" : "border-line"}`}>
                <input type="radio" name="size" checked={size === s} onChange={() => setSize(s)} className="mt-1" />
                <span><b className="text-ink">{SIZE[s].label}</b><span className="block text-ink-soft">{SIZE[s].hint}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {vehicle && NEEDS_REG(vehicle) && <label className={label}>Registration<input value={reg} onChange={(e) => setReg(e.target.value.toUpperCase())} maxLength={10} className={field} autoComplete="off" /></label>}
      <label className="flex items-start gap-2 text-sm text-ink"><input type="checkbox" checked={two} onChange={(e) => setTwo(e.target.checked)} className="mt-1" />I can bring a second person for items that need two to lift</label>
      <fieldset>
        <legend className={label}>Areas you&apos;re often in (optional)</legend>
        <p className="text-xs text-ink-muted">Fetches here will show as suiting you, even without a journey posted.</p>
        <div className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-3">
          {regions.map((r) => (
            <label key={r.id} className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={areas.includes(r.id)} onChange={(e) => setAreas((a) => (e.target.checked ? [...a, r.id] : a.filter((x) => x !== r.id)))} />{r.name}
            </label>
          ))}
        </div>
      </fieldset>
      <label className={label}>A few words about you (optional)
        <textarea value={statement} onChange={(e) => setStatement(e.target.value)} maxLength={500} rows={3} className={field} placeholder="e.g. I drive between Brae and Lerwick most weekdays." />
      </label>
      <p className="text-xs text-ink-muted">Next you&apos;ll be asked for your driving licence and insurance. OneShetland checks them before you can accept a Fetch.</p>
      {msg && <Notice tone={msg.ok ? "ok" : "error"}>{msg.text}</Notice>}
      <button type="submit" disabled={busy} className={btnPrimary} style={{ background: FETCH_ACCENT }}>{busy ? "Sending…" : "Apply to drive"}</button>
    </form>
  );
}

const DRIVER_STATUS: Record<string, { label: string; detail: string }> = {
  pending: { label: "Under review", detail: "OneShetland is checking your details. We'll let you know." },
  approved: { label: "Approved", detail: "You can accept Fetches while your documents are current." },
  rejected: { label: "Not approved", detail: "Your application wasn't approved." },
  suspended: { label: "Paused", detail: "Your driver account is paused. Please contact OneShetland." },
};
const KIND: Record<string, string> = { driving_licence: "Driving licence", licence: "Driving licence", insurance: "Insurance", vehicle: "Vehicle details", identity: "Proof of identity" };

/** A driver's own verification: status, what each document needs, upload a new copy, and open their own copy through a short-lived link. */
export function VerificationView({ v, applied }: { v: Verification; applied?: boolean }) {
  const s = DRIVER_STATUS[v.driver_status] ?? { label: "Not applied", detail: "" };
  return (
    <div className="space-y-4">
      {applied && <Notice tone="ok">Thanks — your application is in. Add your documents below so OneShetland can review it.</Notice>}
      <section className="rounded-card border border-line bg-paper p-4 shadow-soft" role="status">
        <p className="font-display text-xl font-bold text-ink">{s.label}</p>
        <p className="text-sm text-ink-soft">{s.detail}{v.decision_reason ? ` ${v.decision_reason}` : ""}</p>
        {v.verified_until && <p className="mt-1 text-sm text-ink">Documents current until {v.verified_until}.</p>}
        {v.driver_status === "approved" && !v.can_claim && v.claim_problem && <p className="mt-2 text-sm font-semibold text-amber-800">You can&apos;t accept Fetches right now. {fetchMessage(v.claim_problem)}</p>}
        {v.vehicle?.vehicle_class && <p className="mt-2 text-sm text-ink-soft">Vehicle: {VEHICLES.find((x) => x.value === v.vehicle.vehicle_class)?.label ?? v.vehicle.vehicle_class} · up to {sizeLabel(v.vehicle.max_size_class)}{v.vehicle.can_two_person_lift ? " · two-person lift" : ""}</p>}
      </section>
      <ul className="space-y-3">
        {v.requirements.filter((r) => r.required).map((r) => <Requirement key={r.kind} r={r} />)}
      </ul>
      <VehicleChange current={v.vehicle?.vehicle_class} />
    </div>
  );
}

function Requirement({ r }: { r: Verification["requirements"][number] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const st = evidenceState(r.current, r.awaiting_review);
  async function add(file?: File) {
    if (!file) return;
    setBusy(true); setMsg(null);
    const up = await uploadOne(file, (m, s) => evidenceBeginAction(r.kind, m, s) as never, (u) => evidenceSubmitAction(u));
    setBusy(false);
    setMsg(up.ok ? { ok: true, text: "Sent for review." } : { ok: false, text: up.message });
    if (up.ok) router.refresh();
  }
  async function view(id: string) {
    const res = await evidenceViewAction(id).catch(() => null);
    if (res?.ok) window.open(res.data.url, "_blank", "noopener,noreferrer"); else setMsg({ ok: false, text: res?.message ?? "We couldn't open that." });
  }
  const mine = (r.awaiting_review ?? r.current) as { item_id?: string } | null;
  return (
    <li className="rounded-card border border-line bg-paper p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-ink">{KIND[r.kind] ?? r.kind.replace(/_/g, " ")}</p>
        <p className={`text-sm font-semibold ${st.tone === "good" ? "text-emerald-700" : st.tone === "attention" ? "text-amber-800" : "text-ink-soft"}`}>{st.label}</p>
      </div>
      {r.guidance && <p className="mt-1 text-sm text-ink-soft">{r.guidance}</p>}
      {(r.current as { note?: string } | null)?.note && st.label === "Needs replacing" && <p className="mt-1 text-sm text-ink">OneShetland said: {(r.current as { note?: string }).note}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {mine?.item_id && <button type="button" onClick={() => view(mine.item_id!)} className={btnQuiet}>View what I sent</button>}
        <label className="text-sm font-semibold text-ink">{busy ? "Uploading…" : r.current || r.awaiting_review ? "Upload a new copy" : "Upload"}
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(e) => add(e.target.files?.[0])} className="mt-1 block text-sm font-normal" />
        </label>
      </div>
      {msg && <div className="mt-2"><Notice tone={msg.ok ? "ok" : "error"}>{msg.text}</Notice></div>}
    </li>
  );
}

function VehicleChange({ current }: { current?: string }) {
  const [vehicle, setVehicle] = useState("");
  const [size, setSize] = useState("");
  const [reg, setReg] = useState("");
  return (
    <details className="rounded-card border border-line bg-paper p-4">
      <summary className="cursor-pointer font-semibold text-ink">Changed your vehicle?</summary>
      <div className="mt-3 space-y-3">
        <label className={label}>New vehicle
          <select value={vehicle} onChange={(e) => { setVehicle(e.target.value); setSize(""); }} className={field}>
            <option value="">Choose…</option>{VEHICLES.filter((v) => v.value !== current).map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
          </select>
        </label>
        {vehicle && <label className={label}>Largest item<select value={size} onChange={(e) => setSize(e.target.value)} className={field}><option value="">Choose…</option>{fits(vehicle).map((s) => <option key={s} value={s}>{SIZE[s].label}</option>)}</select></label>}
        {vehicle && NEEDS_REG(vehicle) && <label className={label}>Registration<input value={reg} onChange={(e) => setReg(e.target.value.toUpperCase())} className={field} /></label>}
        {vehicle && size && (!NEEDS_REG(vehicle) || reg.trim()) && (
          <ActionDialog trigger="Save my vehicle" title="Change your vehicle?" confirm="Change vehicle"
            body="Your vehicle's insurance and details will need checking again before you can accept another Fetch. Jobs you already have aren't affected."
            run={() => setVehicleAction({ vehicle_class: vehicle, max_size_class: size, vehicle_reg: reg.trim() || undefined })} />
        )}
      </div>
    </details>
  );
}

/** Posting a journey: where from, where to, the departure window, what fits. Matching Fetches are then shown first. */
export function JourneyForm({ regions, categories }: { regions: Region[]; categories: { slug: string; name: string }[] }) {
  const router = useRouter();
  const [o, setO] = useState(""); const [d, setD] = useState("");
  const [start, setStart] = useState(""); const [end, setEnd] = useState("");
  const [max, setMax] = useState(""); const [cats, setCats] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const s = Date.parse(start), e = Date.parse(end);
  const problemsAt = (now: number) => [!o && "Choose where you're leaving from.", !d && "Choose where you're going.", o && o === d && "Choose two different places.",
    !s && "Choose when you're leaving.", s && s < now - 60_000 && "Choose a time from now on.", s && s > now + 14 * 86400_000 && "Journeys can be posted up to 14 days ahead.",
    !e && "Choose your latest departure time.", s && e && (e <= s || e - s > 12 * 3600_000) && "The window must be up to 12 hours after the earliest time."].filter(Boolean) as string[];

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const problems = problemsAt(Date.now());
    if (problems.length) { setMsg(problems.join(" ")); return; }
    setBusy(true); setMsg(null);
    const r = await createRunAction({ origin_region_id: o, destination_region_id: d, departure_start: new Date(s).toISOString(), departure_end: new Date(e).toISOString(),
      categories: cats, max_size_class: (max || null) as Size | null }).catch(() => null);
    setBusy(false);
    if (!r || !r.ok) { setMsg(r?.message ?? "We couldn't reach OneShetland. Please try again."); return; }
    router.push("/fetch/board");
  }
  const opts = regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>);
  return (
    <form onSubmit={submit} className="space-y-4 rounded-card border border-line bg-paper p-5 shadow-soft">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>Leaving from<select value={o} onChange={(x) => setO(x.target.value)} className={field}><option value="">Choose…</option>{opts}</select></label>
        <label className={label}>Going to<select value={d} onChange={(x) => setD(x.target.value)} className={field}><option value="">Choose…</option>{opts}</select></label>
        <label className={label}>Leaving from (earliest)<input type="datetime-local" value={start} onChange={(x) => setStart(x.target.value)} className={field} /></label>
        <label className={label}>Leaving by (latest)<input type="datetime-local" value={end} onChange={(x) => setEnd(x.target.value)} className={field} /></label>
      </div>
      <label className={label}>Room for (optional)
        <select value={max} onChange={(x) => setMax(x.target.value)} className={field}><option value="">Whatever my vehicle takes</option>{SIZES.map((z) => <option key={z} value={z}>{SIZE[z].label} and smaller</option>)}</select>
      </label>
      {categories.length > 0 && (
        <fieldset>
          <legend className={label}>Only these kinds of item (optional)</legend>
          <div className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-3">
            {categories.map((c) => (
              <label key={c.slug} className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={cats.includes(c.slug)} onChange={(x) => setCats((a) => (x.target.checked ? [...a, c.slug] : a.filter((y) => y !== c.slug)))} />{c.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {msg && <Notice tone="error">{msg}</Notice>}
      <button type="submit" disabled={busy} className={btnPrimary} style={{ background: FETCH_ACCENT }}>{busy ? "Posting…" : "Post my journey"}</button>
    </form>
  );
}

export function JourneyList({ runs }: { runs: Run[] }) {
  if (!runs.length) return <p className="text-sm text-ink-muted">No journeys posted. <Link href="/fetch/journeys/new" className="font-semibold underline">Post one</Link> and Fetches that fit show first.</p>;
  return (
    <ul className="divide-y divide-line">
      {runs.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
          <span className="font-semibold text-ink">{r.origin} → {r.destination}</span>
          <span className="text-ink-soft">{when(r.departure_start)}{r.max_size_class ? ` · up to ${sizeLabel(r.max_size_class)}` : ""}{r.crosses_water ? " · ferry" : ""}</span>
          <span className="ml-auto">
            {r.status === "open" ? (
              <ActionDialog trigger="Cancel" title="Cancel this journey?" confirm="Cancel journey" danger triggerClass={btnQuiet}
                body="Fetches will no longer be matched to it. Jobs you've already accepted aren't affected." run={() => cancelRunAction(r.id)} />
            ) : <span className="text-ink-muted">{r.status === "past" ? "Past" : r.status === "cancelled" ? "Cancelled" : "Closed"}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
