"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { saveAccessibility } from "@/lib/accessibility-client";
import { GROUPS, STATUS_LABEL, STATUS_ORDER, type Fact, type FactStatus, type ProfileWithFacts, type SubjectType } from "@/lib/accessibility";

type Answer = { status: FactStatus | ""; detail: string };

/**
 * The guided form owners use. Nothing is compulsory: a facility left on "No answer" is simply not shown. Saving a draft keeps it private;
 * publishing makes it public immediately. The database re-checks who may edit and every length, so this form never decides anything alone.
 */
export function AccessibilityEditor({ type, id, name, initial, backHref, viewHref }: { type: SubjectType; id: string; name: string; initial: ProfileWithFacts | null; backHref: string; viewHref: string }) {
  const uid = useId();
  const [ans, setAns] = useState<Record<string, Answer>>(() => Object.fromEntries((initial?.facts ?? []).map((f) => [f.facility, { status: f.status, detail: f.detail ?? "" }])));
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [tips, setTips] = useState(initial?.visit_tips ?? "");
  const [contact, setContact] = useState(initial?.access_contact ?? "");
  const [published, setPublished] = useState(initial?.published ?? false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const set = (k: string, patch: Partial<Answer>) => setAns((a) => ({ ...a, [k]: { ...(a[k] ?? { status: "" as const, detail: "" }), ...patch } }));
  const answered = Object.entries(ans).filter(([, v]) => v.status !== "");

  async function go(publish: boolean, confirm = false) {
    setBusy(true); setMsg(null);
    try {
      const facts: Fact[] = answered.map(([facility, v]) => ({ facility, status: v.status as FactStatus, detail: v.detail.trim() || null }));
      const r = await saveAccessibility(type, id, publish, { summary, visit_tips: tips, access_contact: contact }, facts, confirm);
      setPublished(r.published);
      setMsg({ ok: true, text: r.published ? "Saved and visible on your public page." : "Saved as a draft. Only you can see it." });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); void go(true); }} className="space-y-8" noValidate>
      {initial?.hidden_by_staff && (
        <p role="alert" className="rounded-card border border-rose-700 bg-rose-50 p-4 text-sm text-rose-950"><strong>This information is hidden from the public.</strong> {initial.hidden_reason ? `Reason: ${initial.hidden_reason}. ` : ""}Please edit it, then contact us so it can be shown again.</p>
      )}
      <div className="rounded-card border border-line bg-paper p-5">
        <p className="text-base">Tell people what to expect at <strong>{name}</strong>. Answer only what you know. Anything you leave blank is simply not shown, and is <em>never</em> read as “not accessible”.</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-soft">
          <li>It is free, whatever your plan.</li>
          <li>Describe the place and what you offer. Please do not write anything about individual customers’ health or disabilities.</li>
          <li>You can save a draft, come back, and change anything later.</li>
        </ul>
        <p className="mt-3 text-sm font-semibold">{published ? "Status: published." : "Status: not published yet."}</p>
      </div>

      <div>
        <label htmlFor={`${uid}-sum`} className="block font-display text-lg font-bold">In a few words (optional)</label>
        <p id={`${uid}-sumh`} className="text-sm text-ink-soft">For example: “Ground-floor café with a level entrance. The toilet is up one step.”</p>
        <textarea id={`${uid}-sum`} aria-describedby={`${uid}-sumh`} rows={3} maxLength={1000} value={summary} onChange={(e) => setSummary(e.target.value)} className="mt-2 w-full rounded-lg border border-line-strong p-3 text-base" />
      </div>

      {GROUPS.map((g) => (
        <section key={g.id} aria-labelledby={`${uid}-${g.id}`}>
          <h2 id={`${uid}-${g.id}`} className="font-display text-xl font-bold">{g.title}</h2>
          <div className="mt-3 space-y-4">
            {g.facilities.map((f) => {
              const a = ans[f.key] ?? { status: "", detail: "" };
              const name = `${uid}-${f.key}`;
              return (
                <fieldset key={f.key} className="rounded-card border border-line bg-white p-4">
                  <legend className="px-1 font-semibold">{f.label}</legend>
                  {f.hint && <p className="mb-2 text-sm text-ink-soft">{f.hint}</p>}
                  <div className="flex flex-wrap gap-x-5 gap-y-1">
                    {STATUS_ORDER.map((s) => (
                      <label key={s} className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name={name} checked={a.status === s} onChange={() => set(f.key, { status: s })} className="h-5 w-5" /> {STATUS_LABEL[s]}</label>
                    ))}
                    <label className="flex min-h-11 items-center gap-2 text-sm text-ink-soft"><input type="radio" name={name} checked={a.status === ""} onChange={() => set(f.key, { status: "", detail: "" })} className="h-5 w-5" /> No answer</label>
                  </div>
                  {a.status !== "" && (
                    <div className="mt-2">
                      <label htmlFor={`${name}-d`} className="text-sm font-semibold">Details (optional)</label>
                      <input id={`${name}-d`} type="text" maxLength={400} value={a.detail} onChange={(e) => set(f.key, { detail: e.target.value })} className="mt-1 w-full rounded-lg border border-line-strong p-3 text-base" />
                    </div>
                  )}
                </fieldset>
              );
            })}
          </div>
        </section>
      ))}

      <div className="space-y-6">
        <div>
          <label htmlFor={`${uid}-tips`} className="block font-display text-lg font-bold">Tips for visiting (optional)</label>
          <p className="text-sm text-ink-soft">Quietest times, the best entrance, what to ask for.</p>
          <textarea id={`${uid}-tips`} rows={3} maxLength={1000} value={tips} onChange={(e) => setTips(e.target.value)} className="mt-2 w-full rounded-lg border border-line-strong p-3 text-base" />
        </div>
        <div>
          <label htmlFor={`${uid}-con`} className="block font-display text-lg font-bold">Who to ask about access (optional)</label>
          <p className="text-sm text-ink-soft">A name, phone number or email that people can use before they come. This will be shown publicly.</p>
          <input id={`${uid}-con`} type="text" maxLength={300} value={contact} onChange={(e) => setContact(e.target.value)} className="mt-2 w-full rounded-lg border border-line-strong p-3 text-base" />
        </div>
      </div>

      <div className="sticky bottom-0 -mx-4 border-t border-line bg-white/95 px-4 py-3 backdrop-blur">
        <div aria-live="polite" className="min-h-6 text-sm font-semibold">{msg && <span role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-emerald-900" : "text-rose-800"}>{msg.text}</span>}</div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy} className="min-h-11 rounded-pill bg-ink px-6 text-sm font-bold text-white disabled:opacity-50">{published ? "Save changes" : "Publish"}</button>
          <button type="button" disabled={busy} onClick={() => void go(false)} className="min-h-11 rounded-pill border border-line-strong px-5 text-sm font-semibold disabled:opacity-50">{published ? "Unpublish and keep as a draft" : "Save draft"}</button>
          {published && <button type="button" disabled={busy} onClick={() => void go(true, true)} className="min-h-11 rounded-pill border border-line-strong px-5 text-sm font-semibold disabled:opacity-50">Confirm this is still right</button>}
          <Link href={published ? viewHref : backHref} className="min-h-11 inline-flex items-center px-2 text-sm font-semibold underline">{published ? "View public page" : "Back"}</Link>
        </div>
      </div>
    </form>
  );
}
