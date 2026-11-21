"use client";
/**
 * ContinuedHelp — the admin side of "they claimed it, but they still want us to help".
 *
 * The default is that an administrator CANNOT edit a record its owner has claimed. There is no button
 * here that changes that by itself: the permission belongs to the owner, who turns it on from their
 * own manage screen. All this screen can do is WRITE DOWN a permission the owner gave another way —
 * and it insists on a note saying how they gave it, shows the grant as "they asked us" wherever it
 * appears, and lists every edit made under it.
 */
import { useEffect, useState, useTransition } from "react";
import type { AssistedKind } from "@/lib/assisted/shape";
import type { SupportEdit, SupportState } from "@/lib/assisted/invites.server";

const until = (iso: string) => {
  try { return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); }
  catch { return iso.slice(0, 10); }
};

export function ContinuedHelp({ kind, subjectId, subjectName, readState, record, end, log }: {
  kind: AssistedKind;
  subjectId: string;
  subjectName: string;
  readState: (input: { kind: AssistedKind; id: string }) => Promise<SupportState>;
  record: (input: { kind: AssistedKind; id: string; days: number; note: string }) => Promise<{ ok: boolean; error?: string }>;
  end: (input: { kind: AssistedKind; id: string; reason: string | null }) => Promise<{ ok: boolean; error?: string }>;
  log: (input: { kind: AssistedKind; id: string }) => Promise<SupportEdit[]>;
}) {
  const [state, setState] = useState<SupportState | null>(null);
  const [edits, setEdits] = useState<SupportEdit[] | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => { void readState({ kind, id: subjectId }).then(setState); }, [kind, subjectId, readState]);
  const refresh = () => start(() => { void readState({ kind, id: subjectId }).then(setState); });

  if (!state) return null;

  return (
    <div className="mt-4 rounded-xl border border-line bg-sand/30 p-4">
      <h5 className="text-sm font-bold text-ink">Still helping?</h5>
      {state.active ? (
        <div className="mt-2 space-y-2 text-sm text-ink-soft">
          <p>
            <strong className="text-ink">You may edit this until {until(state.expires_at)}.</strong>{" "}
            {state.via === "owner"
              ? `${subjectName} turned this on themselves.`
              : "You recorded this after they asked — it is marked as such everywhere."}
          </p>
          {state.note && <p className="rounded-lg bg-white px-3 py-2 text-ink">{state.note}</p>}
          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              disabled={pending}
              onClick={async () => {
                setError(null);
                const r = await end({ kind, id: subjectId, reason: "ended by an administrator" });
                if (!r.ok) setError(r.error ?? "Could not end it."); else refresh();
              }}
              className="text-sm font-bold text-navy hover:underline disabled:opacity-60"
            >
              End it now
            </button>
            <button type="button" onClick={async () => setEdits(await log({ kind, id: subjectId }))} className="text-sm font-bold text-navy hover:underline">
              See what we changed
            </button>
          </div>
        </div>
      ) : !open ? (
        <div className="mt-2 space-y-2 text-sm text-ink-soft">
          <p>
            {subjectName} looks after this themselves, so you cannot edit it. They can turn help on from their own
            manage screen whenever they like.
          </p>
          <div className="flex flex-wrap gap-4">
            <button type="button" onClick={() => { setOpen(true); setError(null); }} className="text-sm font-bold text-navy hover:underline">
              They asked me to help — write it down…
            </button>
            <button type="button" onClick={async () => setEdits(await log({ kind, id: subjectId }))} className="text-sm font-bold text-navy hover:underline">
              See what we changed before
            </button>
          </div>
        </div>
      ) : (
        <form
          className="mt-2 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const note = String(f.get("note") ?? "").trim();
            setError(null);
            const r = await record({ kind, id: subjectId, days: Number(f.get("days") ?? 90) || 90, note });
            if (!r.ok) setError(r.error ?? "Could not record that."); else { setOpen(false); refresh(); }
          }}
        >
          <p className="text-sm text-ink-soft">
            Only write this down if they actually asked. It is recorded with your name and shown to them on their own
            screen, marked as a permission you recorded rather than one they set.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-ink" htmlFor={`ch-days-${subjectId}`}>For how long?</label>
              <select id={`ch-days-${subjectId}`} name="days" className="auth-input w-full" defaultValue="90">
                <option value="30">A month</option>
                <option value="90">Three months</option>
                <option value="180">Six months</option>
                <option value="365">A year</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-ink" htmlFor={`ch-note-${subjectId}`}>How did they ask? <span className="font-normal text-ink-soft">(required)</span></label>
              <input id={`ch-note-${subjectId}`} name="note" required minLength={10} className="auth-input w-full"
                placeholder="e.g. Ina rang on 21 November and asked us to keep the events up to date." />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={pending} className="min-h-11 rounded-pill bg-navy px-5 text-sm font-bold text-white hover:bg-navy-dark disabled:opacity-60">
              {pending ? "Saving…" : "Record the permission"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-sm font-bold text-navy hover:underline">Cancel</button>
          </div>
        </form>
      )}

      {edits && (
        <div className="mt-3 rounded-xl border border-line bg-white p-3">
          <div className="flex items-baseline justify-between gap-2">
            <h6 className="text-sm font-bold text-ink">Edits made under a permission</h6>
            <button type="button" onClick={() => setEdits(null)} className="text-xs font-bold text-navy hover:underline">Close</button>
          </div>
          {!edits.length ? (
            <p className="mt-2 text-sm text-ink-soft">None. We have changed nothing since they claimed it.</p>
          ) : (
            <ol className="mt-2 space-y-1.5 text-sm text-ink-soft">
              {edits.map((e, i) => (
                <li key={`${e.at}-${i}`} className="flex flex-wrap gap-x-2">
                  <span className="font-mono text-xs text-ink-muted">{new Date(e.at).toLocaleString("en-GB")}</span>
                  <span className="font-semibold text-ink">{e.actor_name ?? "an administrator"}</span>
                  <span>changed {Object.keys(e.fields ?? {}).join(", ") || "nothing"}</span>
                  {e.granted_via === "owner_asked_us" && <span className="text-xs text-ink-muted">(permission recorded by us)</span>}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-900">{error}</p>}
    </div>
  );
}
