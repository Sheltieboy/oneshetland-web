"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FETCH, DELIVERY_CATEGORIES } from "@/lib/fetch-data";

function localInput(d: Date): string {
  // value for <input type="datetime-local">
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function RunComposer({ canCreate }: { canCreate: boolean }) {
  const router = useRouter();
  const now = new Date();
  now.setMinutes(0, 0, 0); now.setHours(now.getHours() + 1);
  const later = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const [origin, setOrigin] = useState("Lerwick");
  const [destination, setDestination] = useState("");
  const [destArea, setDestArea] = useState("");
  const [start, setStart] = useState(localInput(now));
  const [end, setEnd] = useState(localInput(later));
  const [cats, setCats] = useState<string[]>([]);
  const [ferry, setFerry] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(slug: string) {
    setCats((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  }

  async function submit() {
    setError(null);
    if (!destination.trim()) { setError("Where are you heading? Add a destination."); return; }
    if (cats.length === 0) { setError("Pick at least one category you can carry."); return; }
    if (new Date(end) <= new Date(start)) { setError("The latest time must be after the earliest time."); return; }
    setBusy(true);
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error("Please sign in.");
      const { error: insErr } = await sb.from("runs").insert({
        driver_id: user.id,
        origin_region_id: null,
        destination_region_id: null,
        destination_area: destArea.trim() || null,
        departure_start: new Date(start).toISOString(),
        departure_end: new Date(end).toISOString(),
        categories_accepted: cats,
        ferry_crossing: ferry,
        notes: [`Origin: ${origin.trim() || "Lerwick"}`, `Destination: ${destination.trim()}`, notes.trim()].filter(Boolean).join("\n"),
        status: "open",
      });
      if (insErr) throw insErr;
      router.push("/fetch?tab=driver");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create your run.");
      setBusy(false);
    }
  }

  if (!canCreate) {
    return (
      <div className="rounded-card border border-amber-300 bg-amber-50 p-5">
        <p className="font-bold text-amber-900">Connect your bank account first</p>
        <p className="mt-1 text-sm text-amber-900/80">You need an approved driver account with payouts enabled before you can create runs.</p>
        <a href="/account/payments" className="mt-3 inline-block rounded-pill px-5 py-2.5 text-sm font-semibold text-white" style={{ background: FETCH }}>Set up payouts →</a>
      </div>
    );
  }

  const field = "w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-ink shadow-soft outline-none placeholder:text-ink-faint";

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="mb-1 block text-sm font-semibold text-ink-soft">Origin</label><input value={origin} onChange={(e) => setOrigin(e.target.value)} className={field} /></div>
        <div><label className="mb-1 block text-sm font-semibold text-ink-soft">Destination</label><input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="e.g. Brae, Yell, Scalloway" className={field} /></div>
      </div>
      <div><label className="mb-1 block text-sm font-semibold text-ink-soft">Destination area / village (optional)</label><input value={destArea} onChange={(e) => setDestArea(e.target.value)} placeholder="e.g. Mid Yell" className={field} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="mb-1 block text-sm font-semibold text-ink-soft">Earliest departure</label><input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={field} /></div>
        <div><label className="mb-1 block text-sm font-semibold text-ink-soft">Latest departure</label><input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className={field} /></div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold text-ink-soft">Categories I can carry</label>
        <div className="flex flex-wrap gap-2">
          {DELIVERY_CATEGORIES.map((c) => {
            const on = cats.includes(c.slug);
            return (
              <button key={c.slug} type="button" onClick={() => toggle(c.slug)} className="rounded-pill border px-3 py-1.5 text-sm font-semibold transition"
                style={on ? { borderColor: FETCH, background: `${FETCH}1a`, color: FETCH } : { borderColor: "var(--color-line-strong)", color: "var(--color-ink-soft)" }}>
                {c.icon} {c.name}
              </button>
            );
          })}
        </div>
      </div>
      <button type="button" onClick={() => setFerry(!ferry)} className="flex w-full items-center justify-between rounded-xl border border-line bg-paper px-4 py-3 text-left">
        <span><span className="block text-sm font-semibold text-ink">Ferry crossing involved</span><span className="block text-xs text-ink-muted">Tick if your route involves a Shetland ferry.</span></span>
        <span className="relative inline-flex h-6 w-11 items-center rounded-full" style={{ background: ferry ? FETCH : "var(--color-line-strong)" }}>
          <span className={"inline-block h-5 w-5 transform rounded-full bg-white shadow transition " + (ferry ? "translate-x-5" : "translate-x-0.5")} />
        </span>
      </button>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes (optional) — boot space, fragile OK, timing flexibility" className={field + " min-h-[80px]"} />
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button onClick={submit} disabled={busy} className="w-full rounded-pill py-3 font-semibold text-white transition hover:brightness-110 disabled:opacity-40" style={{ background: FETCH }}>
        {busy ? "Creating…" : "Create run"}
      </button>
      <p className="text-center text-xs text-ink-faint">Only approved drivers may create runs. By submitting you confirm you hold a valid UK licence and appropriate insurance.</p>
    </div>
  );
}
