"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { searchVessels, vesselDisplayTitle, BOATS, type VesselSearchRow } from "@/lib/boats-data";

/**
 * AddBoatForm — submit a brand-new BOAT (hull) to Da Boats. A boat here is the
 * physical hull, which keeps its identity across renames and re-registrations —
 * so the form leads with that, searches existing hulls live as you type the
 * name (to stop a renamed boat being added twice), and treats the name as the
 * hull's *current* name with former names captured as history. Lands in
 * vessel_submissions as 'pending' for a moderator to approve.
 */

const HULL_OPTIONS: [string, string][] = [
  ["W", "Wood"], ["S", "Steel"], ["F", "Fibreglass"], ["A", "Aluminium"], ["O", "Other"], ["U", "Unknown"],
];

export function AddBoatForm() {
  const [name, setName] = useState("");
  const [lk, setLk] = useState("");
  const [builtYear, setBuiltYear] = useState("");
  const [builder, setBuilder] = useState("");
  const [yardNumber, setYardNumber] = useState("");
  const [hull, setHull] = useState("");
  const [country, setCountry] = useState("");
  const [statusText, setStatusText] = useState("");
  const [formerNames, setFormerNames] = useState("");
  const [notes, setNotes] = useState("");
  const [submitterName, setSubmitterName] = useState("");
  const [showName, setShowName] = useState(true);

  const [matches, setMatches] = useState<VesselSearchRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [dupeId, setDupeId] = useState<string | null>(null); // a match the user says IS this boat
  const [ackChecked, setAckChecked] = useState(false); // "I've checked, it's not listed"

  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live duplicate search on the name / reg — the main safeguard against adding
  // a renamed boat as a second hull.
  useEffect(() => {
    const term = `${name} ${lk}`.trim();
    if (debounce.current) clearTimeout(debounce.current);
    if (term.length < 2) { setMatches([]); return; }
    setSearching(true);
    debounce.current = setTimeout(async () => {
      const rows = await searchVessels(term, 6);
      setMatches(rows);
      setSearching(false);
    }, 350);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [name, lk]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) { setError("Please enter the boat's name."); return; }
    if (matches.length > 0 && !dupeId && !ackChecked) {
      setError("Please check the possible matches above, then confirm this boat isn't already listed.");
      return;
    }
    const yr = builtYear.trim() ? parseInt(builtYear.trim(), 10) : null;
    if (builtYear.trim() && (Number.isNaN(yr!) || yr! < 1700 || yr! > 2100)) { setError("Please enter a valid year built."); return; }
    setStatus("saving");
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      const { error: insErr } = await sb.from("vessel_submissions").insert({
        canonical_name: name.trim(),
        primary_lk_number: lk.trim() || null,
        built_year: yr,
        builder: builder.trim() || null,
        yard_number: yardNumber.trim() || null,
        hull_material: hull || null,
        country_of_build: country.trim() || null,
        status: statusText.trim() || null,
        former_names: formerNames.trim() || null,
        identity_notes: notes.trim() || null,
        possible_duplicate_id: dupeId,
        submitter_id: user?.id ?? null,
        submitter_name: submitterName.trim() || null,
        show_name: showName,
        submission_status: "pending",
      });
      if (insErr) throw insErr;
      setStatus("done");
    } catch {
      setStatus("error");
      setError("Something went wrong — please try again in a moment.");
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-xl border border-line bg-paper p-8 text-center shadow-soft sm:p-12">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full text-2xl text-paper" style={{ background: BOATS }} aria-hidden>✓</span>
        <h2 className="mt-5 font-display text-2xl font-bold">Thank you!</h2>
        <p className="mx-auto mt-2 max-w-md text-ink-soft">
          &ldquo;{name.trim()}&rdquo; has been sent for review. Once it&apos;s approved it&apos;ll appear in Da Boats
          {showName && submitterName.trim() ? `, with “${submitterName.trim()}” credited.` : "."}
        </p>
        <Link href="/boats" className="mt-6 inline-block rounded-pill px-5 py-3 font-semibold text-paper" style={{ background: BOATS }}>
          Back to Da Boats
        </Link>
      </div>
    );
  }

  const inputCls = "w-full rounded-lg border border-line bg-cream/40 px-4 py-2.5 text-ink outline-none focus:border-[color:var(--boats)]";
  const labelCls = "font-semibold text-ink";

  return (
    <form onSubmit={submit} className="space-y-4" style={{ "--boats": BOATS } as React.CSSProperties}>
      {/* Hull explainer */}
      <div className="rounded-xl border p-5" style={{ borderColor: `${BOATS}55`, background: `${BOATS}0d` }}>
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-paper" style={{ background: BOATS }} aria-hidden>⚓</span>
          <div>
            <h3 className="font-display text-lg font-bold text-ink">You&apos;re adding a boat&apos;s hull</h3>
            <p className="mt-1 text-sm text-ink-soft">
              Da Boats records the <strong>hull</strong> — the physical boat. A hull keeps the same identity even when it&apos;s
              renamed or re-registered over the years. So add the boat you know, and if it&apos;s carried other names, add those
              as <em>former names</em> below rather than as a separate boat. If the hull is already listed under an old name,
              please add your details there instead — we&apos;ll show any matches as you type.
            </p>
          </div>
        </div>
      </div>

      {/* Name + live duplicate check */}
      <div className="rounded-xl border-2 bg-paper p-5 shadow-soft" style={{ borderColor: BOATS }}>
        <label className="font-display text-lg font-bold" htmlFor="name">Boat name (current) <span style={{ color: BOATS }}>*</span></label>
        <p className="mt-1 text-sm text-ink-muted">The hull&apos;s current or best-known name — not a former name.</p>
        <input id="name" value={name} onChange={(e) => { setName(e.target.value); setDupeId(null); setAckChecked(false); }} placeholder="e.g. Serene" className={inputCls + " mt-3 text-lg"} autoFocus />

        <label className="mt-4 block font-semibold text-ink" htmlFor="lk">Registration / LK number <span className="text-xs font-normal text-ink-faint">· optional</span></label>
        <p className="mt-0.5 text-xs text-ink-muted">e.g. LK297. Helps identify the hull.</p>
        <input id="lk" value={lk} onChange={(e) => setLk(e.target.value)} placeholder="LK…" className={inputCls + " mt-2"} />

        {/* Possible matches */}
        {(searching || matches.length > 0) && (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
            <p className="text-sm font-bold text-amber-900">
              {searching ? "Checking Da Boats…" : "Is it one of these already?"}
            </p>
            {!searching && (
              <>
                <p className="mt-0.5 text-xs text-amber-800">A renamed boat is the same hull — please don&apos;t add it twice. Tap a match to view it.</p>
                <ul className="mt-2 space-y-1.5">
                  {matches.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-3 rounded-md bg-white/70 px-3 py-2">
                      <div className="min-w-0">
                        <a href={`/boats/${m.id}`} target="_blank" rel="noreferrer" className="font-semibold text-ink underline-offset-2 hover:underline">
                          {vesselDisplayTitle({ primary_lk_number: m.primary_lk_number, canonical_name: m.canonical_name })}
                        </a>
                        {m.all_names && m.all_names !== m.canonical_name && (
                          <span className="block truncate text-xs text-ink-muted">also: {m.all_names}</span>
                        )}
                      </div>
                      <button type="button" onClick={() => setDupeId(dupeId === m.id ? null : m.id)}
                        className={"shrink-0 rounded-pill border px-3 py-1 text-xs font-semibold " + (dupeId === m.id ? "border-transparent bg-amber-600 text-white" : "border-amber-400 text-amber-800 hover:bg-amber-100")}>
                        {dupeId === m.id ? "✓ This is it" : "This is it"}
                      </button>
                    </li>
                  ))}
                </ul>
                {dupeId ? (
                  <p className="mt-2 text-xs font-medium text-amber-900">
                    Grand — you can still submit to flag corrections, and a moderator will merge them into that hull.
                  </p>
                ) : (
                  <label className="mt-3 flex items-center gap-2 text-sm font-medium text-amber-900">
                    <input type="checkbox" checked={ackChecked} onChange={(e) => setAckChecked(e.target.checked)} className="h-4 w-4 accent-amber-600" />
                    None of these — this hull isn&apos;t listed yet.
                  </label>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Hull identity */}
      <div className="rounded-xl border border-line bg-paper p-5 shadow-soft">
        <h3 className="font-display text-lg font-bold text-ink">About the hull</h3>
        <p className="mt-0.5 text-sm text-ink-muted">Fill in as much as you know — every bit helps identify the boat.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="built">Year built</label>
            <input id="built" inputMode="numeric" value={builtYear} onChange={(e) => setBuiltYear(e.target.value)} placeholder="e.g. 1988" className={inputCls + " mt-2"} />
          </div>
          <div>
            <label className={labelCls} htmlFor="hull">Hull material</label>
            <select id="hull" value={hull} onChange={(e) => setHull(e.target.value)} className={inputCls + " mt-2"}>
              <option value="">—</option>
              {HULL_OPTIONS.map(([code, lbl]) => <option key={code} value={code}>{lbl}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="builder">Builder / yard</label>
            <input id="builder" value={builder} onChange={(e) => setBuilder(e.target.value)} placeholder="e.g. Herd & Mackenzie, Buckie" className={inputCls + " mt-2"} />
          </div>
          <div>
            <label className={labelCls} htmlFor="yardno">Yard number</label>
            <input id="yardno" value={yardNumber} onChange={(e) => setYardNumber(e.target.value)} placeholder="optional" className={inputCls + " mt-2"} />
          </div>
          <div>
            <label className={labelCls} htmlFor="country">Country of build</label>
            <input id="country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. Scotland" className={inputCls + " mt-2"} />
          </div>
          <div>
            <label className={labelCls} htmlFor="statusText">Status now</label>
            <input id="statusText" value={statusText} onChange={(e) => setStatusText(e.target.value)} placeholder="e.g. Active, Lost, Scrapped" className={inputCls + " mt-2"} />
          </div>
        </div>
      </div>

      {/* History */}
      <div className="rounded-xl border border-line bg-paper p-5 shadow-soft">
        <label className={labelCls} htmlFor="former">Former names <span className="text-xs font-normal text-ink-faint">· optional</span></label>
        <p className="mt-0.5 text-xs text-ink-muted">Other names this same hull has carried over the years. Separate with commas.</p>
        <input id="former" value={formerNames} onChange={(e) => setFormerNames(e.target.value)} placeholder="e.g. Golden Sheaf, Boy Andrew" className={inputCls + " mt-2"} />
        <label className={labelCls + " mt-4 block"} htmlFor="notes">Anything else</label>
        <p className="mt-0.5 text-xs text-ink-muted">History, owners, what happened to her — whatever you know.</p>
        <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="…" className={inputCls + " mt-2"} />
      </div>

      {/* Attribution */}
      <div className="rounded-xl border border-line bg-paper p-5 shadow-soft">
        <h3 className="font-display text-lg font-bold">Your name</h3>
        <p className="mt-1 text-sm text-ink-muted">Da Boats is built by the community — let folk know you helped.</p>
        <input value={submitterName} onChange={(e) => setSubmitterName(e.target.value)} placeholder="Your name (optional)" className={inputCls + " mt-3"} />
        <label className="mt-3 flex items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-semibold text-ink">Show my name as the contributor</span>
            <span className="block text-xs text-ink-muted">{showName ? "Your name appears against this boat" : "Your contribution stays anonymous"}</span>
          </span>
          <input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} className="h-5 w-5" style={{ accentColor: BOATS }} />
        </label>
      </div>

      {error && <p className="text-center text-sm font-semibold text-rose-600">{error}</p>}

      <button type="submit" disabled={status === "saving"}
        className="w-full rounded-pill px-5 py-3.5 font-semibold text-paper shadow-soft transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
        style={{ background: BOATS }}>
        {status === "saving" ? "Sending…" : "Send this boat for review"}
      </button>
      <p className="px-4 text-center text-xs leading-relaxed text-ink-muted">
        Every new boat is checked by a moderator before it goes live. Thank you for helping record the Shetland fleet.
      </p>
    </form>
  );
}
