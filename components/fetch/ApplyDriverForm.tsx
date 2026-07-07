"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FETCH, VEHICLE_TYPES } from "@/lib/fetch-data";

export function ApplyDriverForm() {
  const router = useRouter();
  const [vehicleType, setVehicleType] = useState("");
  const [vehicleReg, setVehicleReg] = useState("");
  const [statement, setStatement] = useState("");
  const [declared, setDeclared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!vehicleType) return setError("Choose your vehicle type.");
    if (!vehicleReg.trim()) return setError("Enter your vehicle registration.");
    if (statement.trim().length < 20) return setError("Tell us a little more about your typical routes (at least 20 characters).");
    if (!declared) return setError("You must confirm you hold a valid licence and insurance.");
    setBusy(true);
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error("Please sign in.");
      // Submit via the become-driver edge function. This MUST be server-side:
      // migration 064 locks profiles.role and the driver_status columns on
      // user-initiated updates, so a client-side write is silently reverted (the
      // old bug). The function (service role) upserts driver_profiles + sets the
      // pending status. Driver-ness is a capability, NOT a profiles.role flip.
      const { data: result, error: fnError } = await sb.functions.invoke("become-driver", {
        body: { vehicle_type: vehicleType, vehicle_reg: vehicleReg.trim(), statement: statement.trim() },
      });
      if (fnError || (result as { error?: string } | null)?.error) {
        throw new Error((result as { error?: string } | null)?.error ?? fnError?.message ?? "Could not submit your application.");
      }
      router.push("/fetch?tab=driver");
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not submit your application."); setBusy(false); }
  }

  const field = "w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-ink shadow-soft outline-none placeholder:text-ink-faint";

  return (
    <div className="space-y-5">
      <div className="rounded-card border border-blue-200 bg-blue-50 p-4">
        <p className="font-bold text-blue-800">What OneShetland drivers do</p>
        <ul className="mt-2 space-y-1 text-sm text-blue-900/90">
          <li>🚗 Create runs when you&apos;re already travelling somewhere</li>
          <li>📦 Collect goods from Lerwick for customers along your route</li>
          <li>💷 Earn a fair contribution for each delivery — you keep 100% during launch</li>
          <li>🕒 You choose when and where — no obligations</li>
        </ul>
        <p className="mt-2 text-xs text-blue-700">Goods only. No alcohol, tobacco, vapes, cash or passengers.</p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold text-ink-soft">Vehicle type</label>
        <div className="flex flex-wrap gap-2">
          {VEHICLE_TYPES.map((t) => {
            const on = vehicleType === t;
            return (
              <button key={t} type="button" onClick={() => setVehicleType(t)} className="rounded-pill border px-3.5 py-1.5 text-sm font-semibold transition"
                style={on ? { borderColor: FETCH, background: `${FETCH}1a`, color: FETCH } : { borderColor: "var(--color-line-strong)", color: "var(--color-ink-soft)" }}>{t}</button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold text-ink-soft">Vehicle registration</label>
        <input value={vehicleReg} onChange={(e) => setVehicleReg(e.target.value.toUpperCase())} placeholder="e.g. SY24 ABC" className={field} />
        <p className="mt-1 text-xs text-ink-faint">Used to verify your insurance. Not shown publicly.</p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold text-ink-soft">Your typical routes</label>
        <textarea value={statement} onChange={(e) => setStatement(e.target.value)} placeholder="Where do you regularly travel to and from? E.g. Lerwick to Scalloway most days, or regular trips north." className={field + " min-h-[110px]"} />
      </div>

      <button type="button" onClick={() => setDeclared(!declared)} className="flex w-full items-center justify-between gap-3 rounded-card border border-line bg-paper p-4 text-left">
        <span>
          <span className="block text-sm font-bold text-ink">Driver declaration</span>
          <span className="block text-xs text-ink-muted">I hold a valid UK driving licence, have insurance that covers carrying goods, and am legally entitled to drive in the UK.</span>
        </span>
        <span className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full" style={{ background: declared ? FETCH : "var(--color-line-strong)" }}>
          <span className={"inline-block h-5 w-5 transform rounded-full bg-white shadow transition " + (declared ? "translate-x-5" : "translate-x-0.5")} />
        </span>
      </button>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button onClick={submit} disabled={busy} className="w-full rounded-pill py-3 font-semibold text-white transition hover:brightness-110 disabled:opacity-40" style={{ background: FETCH }}>
        {busy ? "Submitting…" : "Submit application"}
      </button>
      <p className="text-center text-xs text-ink-faint">Applications are usually reviewed within 1–2 working days.</p>
    </div>
  );
}
