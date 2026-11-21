"use client";
/**
 * OwnerHelpToggle — "let OneShetland keep helping with this page".
 *
 * The honest framing matters here. By default a platform administrator cannot edit a page its owner
 * has claimed, and that is the right default. This is the owner choosing to lend that permission back
 * for a fixed time, able to end it whenever they like, with every change recorded. It never moves
 * ownership and never takes any of the owner's own permissions away.
 */
import { useEffect, useState, useTransition } from "react";
import type { AssistedKind } from "@/lib/assisted/shape";
import type { SupportState } from "@/lib/assisted/invites.server";

const until = (iso: string) => {
  try { return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); }
  catch { return iso.slice(0, 10); }
};

export function OwnerHelpToggle({ kind, id, readState, grant, end }: {
  kind: AssistedKind;
  id: string;
  readState: (input: { kind: AssistedKind; id: string }) => Promise<SupportState>;
  grant: (input: { kind: AssistedKind; id: string; days: number; note: string | null }) => Promise<{ ok: boolean; error?: string }>;
  end: (input: { kind: AssistedKind; id: string }) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [state, setState] = useState<SupportState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => { void readState({ kind, id }).then(setState); }, [kind, id, readState]);

  const refresh = () => start(() => { void readState({ kind, id }).then(setState); });
  const noun = kind === "hub" ? "page" : "listing";

  if (!state) return null;

  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
      <h3 className="font-display text-lg font-bold text-ink">Help from OneShetland</h3>
      {state.active ? (
        <div className="mt-2 space-y-3 text-sm text-ink-soft">
          <p>
            <strong className="text-ink">OneShetland can edit this {noun} until {until(state.expires_at)}.</strong>{" "}
            {state.via === "owner_asked_us"
              ? "This was written down by OneShetland after you asked them to help."
              : "You turned this on yourself."}
          </p>
          {state.note && <p className="rounded-xl bg-sand px-3 py-2 text-ink">{state.note}</p>}
          <p>
            You are still the owner, and nothing you can do has changed. Every edit OneShetland makes is recorded
            against this {noun}.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={async () => {
              setError(null);
              const r = await end({ kind, id });
              if (!r.ok) setError(r.error ?? "Could not end it just now.");
              else refresh();
            }}
            className="min-h-11 rounded-pill border border-line-strong px-5 text-sm font-bold text-ink-soft hover:bg-sand disabled:opacity-60"
          >
            {pending ? "Working…" : "Stop OneShetland editing this"}
          </button>
        </div>
      ) : !open ? (
        <div className="mt-2 space-y-3 text-sm text-ink-soft">
          <p>
            Nobody at OneShetland can edit this {noun} — only you can. If you would rather they kept it up to date for
            you, you can let them, for as long as you choose.
          </p>
          <button type="button" onClick={() => { setOpen(true); setError(null); }}
            className="min-h-11 rounded-pill bg-navy px-5 text-sm font-bold text-white hover:bg-navy-dark">
            Let OneShetland help with this {noun}
          </button>
        </div>
      ) : (
        <form
          className="mt-3 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            setError(null);
            const r = await grant({
              kind, id,
              days: Number(form.get("days") ?? 90) || 90,
              note: (String(form.get("note") ?? "").trim() || null),
            });
            if (!r.ok) setError(r.error ?? "Could not turn that on just now.");
            else { setOpen(false); refresh(); }
          }}
        >
          <div>
            <label className="block text-sm font-semibold text-ink" htmlFor={`help-days-${id}`}>For how long?</label>
            <select id={`help-days-${id}`} name="days" className="auth-input w-full" defaultValue="90">
              <option value="30">A month</option>
              <option value="90">Three months</option>
              <option value="180">Six months</option>
              <option value="365">A year</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-ink" htmlFor={`help-note-${id}`}>
              Anything they should know? <span className="font-normal text-ink-soft">(optional)</span>
            </label>
            <textarea id={`help-note-${id}`} name="note" rows={2} className="auth-input w-full"
              placeholder="e.g. Please keep the opening hours and the events right; leave the description as it is." />
          </div>
          <p className="text-xs text-ink-muted">
            You stay the owner. You can stop this at any moment, it ends by itself when the time is up, and every edit
            they make is recorded.
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={pending}
              className="min-h-11 rounded-pill bg-navy px-5 text-sm font-bold text-white hover:bg-navy-dark disabled:opacity-60">
              {pending ? "Saving…" : "Turn it on"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-sm font-bold text-navy hover:underline">Cancel</button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-900">{error}</p>}
    </section>
  );
}
