"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SUGGEST_FIELDS, SPIK_COLOR } from "@/lib/spik-data";

/**
 * AddWordForm — submit a brand-new Shetland word to Spik. Captures the headword
 * plus every attribute a dictionary entry can have (reusing SUGGEST_FIELDS), and
 * lands it in spik_word_submissions as 'pending'. An admin approves it in
 * Control Centre, which publishes it live to the dictionary.
 */
export function AddWordForm() {
  const [word, setWord] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitterName, setSubmitterName] = useState("");
  const [showName, setShowName] = useState(true);
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const set = (name: string, val: string) => setValues((p) => ({ ...p, [name]: val }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (word.trim().length < 2) { setError("Please enter the word you'd like to add."); return; }
    if (!(values.short_meaning ?? "").trim()) { setError("Please add at least a short meaning so we know what it means."); return; }
    setStatus("saving");
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      const row: Record<string, unknown> = {
        word: word.trim(),
        submitter_id: user?.id ?? null,
        submitter_name: submitterName.trim() || null,
        show_name: showName,
        status: "pending",
      };
      // Map each filled attribute onto its dictionary column.
      for (const f of SUGGEST_FIELDS) {
        const v = (values[f.name] ?? "").trim();
        if (v) row[f.name] = v;
      }
      const { error: insErr } = await sb.from("spik_word_submissions").insert(row);
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
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full text-2xl text-paper" style={{ background: SPIK_COLOR }} aria-hidden>✓</span>
        <h2 className="mt-5 font-display text-2xl font-bold">Thank you!</h2>
        <p className="mx-auto mt-2 max-w-md text-ink-soft">
          &ldquo;{word.trim()}&rdquo; has been sent for review. Once it&apos;s approved it&apos;ll appear in Spik
          {showName && submitterName.trim() ? `, with &ldquo;${submitterName.trim()}&rdquo; credited as the contributor.` : "."}
        </p>
        <Link href="/spik" className="mt-6 inline-block rounded-pill px-5 py-3 font-semibold text-paper" style={{ background: SPIK_COLOR }}>
          Back to Spik
        </Link>
      </div>
    );
  }

  const inputCls = "w-full rounded-lg border border-line bg-cream/40 px-4 py-2.5 text-ink outline-none focus:border-spik";

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* The word itself */}
      <div className="rounded-xl border-2 bg-paper p-5 shadow-soft" style={{ borderColor: SPIK_COLOR }}>
        <label className="font-display text-lg font-bold" htmlFor="word">The word <span style={{ color: SPIK_COLOR }}>*</span></label>
        <p className="mt-1 text-sm text-ink-muted">The Shetland word or phrase you&apos;d like to add.</p>
        <input id="word" value={word} onChange={(e) => setWord(e.target.value)} placeholder="e.g. peerie" className={inputCls + " mt-3 text-lg"} autoFocus />
      </div>

      {/* Every attribute (meaning first — the only other thing we ask for) */}
      {SUGGEST_FIELDS.map((f) => (
        <div key={f.name} className="rounded-xl border border-line bg-paper p-5 shadow-soft">
          <label className="font-semibold text-ink" htmlFor={f.name}>
            {f.label}{f.name === "short_meaning" ? <span style={{ color: SPIK_COLOR }}> *</span> : <span className="text-xs font-normal text-ink-faint"> · optional</span>}
          </label>
          <p className="mt-0.5 text-xs text-ink-muted">{f.hint}</p>
          {f.type === "select" ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {f.options!.map((opt) => {
                const active = values[f.name] === opt;
                return (
                  <button key={opt} type="button" onClick={() => set(f.name, active ? "" : opt)}
                    className={"rounded-pill border px-3 py-1.5 text-sm font-semibold capitalize transition " + (active ? "text-paper" : "border-line bg-cream/40 text-ink-soft hover:border-spik")}
                    style={active ? { background: SPIK_COLOR, borderColor: SPIK_COLOR } : undefined}>
                    {opt}
                  </button>
                );
              })}
            </div>
          ) : f.type === "multiline" ? (
            <textarea id={f.name} value={values[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} rows={3} placeholder="…" className={inputCls + " mt-3"} />
          ) : (
            <input id={f.name} value={values[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} placeholder="…" className={inputCls + " mt-3"} />
          )}
        </div>
      ))}

      {/* Attribution */}
      <div className="rounded-xl border border-line bg-paper p-5 shadow-soft">
        <h3 className="font-display text-lg font-bold">Your name</h3>
        <p className="mt-1 text-sm text-ink-muted">Shetland dialect is a community project — let folk know you helped.</p>
        <input value={submitterName} onChange={(e) => setSubmitterName(e.target.value)} placeholder="Your name (optional)" className={inputCls + " mt-3"} />
        <label className="mt-3 flex items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-semibold text-ink">Show my name on this word</span>
            <span className="block text-xs text-ink-muted">{showName ? "Your name appears as a contributor" : "Your contribution stays anonymous"}</span>
          </span>
          <input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} className="h-5 w-5 accent-spik" />
        </label>
      </div>

      {error && <p className="text-center text-sm font-semibold text-rose-600">{error}</p>}

      <button type="submit" disabled={status === "saving"}
        className="w-full rounded-pill px-5 py-3.5 font-semibold text-paper shadow-soft transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
        style={{ background: SPIK_COLOR }}>
        {status === "saving" ? "Sending…" : "Send this word for review"}
      </button>
      <p className="px-4 text-center text-xs leading-relaxed text-ink-muted">
        New words are checked by a moderator before they go live. Shetland dialect belongs to everyone — thank you for helping keep it alive.
      </p>
    </form>
  );
}
