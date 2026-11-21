"use client";
/**
 * ClaimsWaiting — the requests to take over an assisted listing or Hub, and the decision.
 *
 * The decision is the whole safeguard. Possession of the invitation link proves nothing, so this
 * screen puts the three things that actually matter in front of Darren before the buttons:
 *
 *   · what the claimant says their connection is, in their own words;
 *   · whether the address they gave matches the address the invitation went to — a match is a hint,
 *     not proof, and the screen says so;
 *   · whether the Hub carries any private history. If it does, the database REFUSES the handover,
 *     and this says so before the button is pressed rather than after.
 */
import { useState } from "react";
import type { WaitingClaim } from "@/lib/assisted/invites.server";
import type { AssistedKind } from "@/lib/assisted/shape";

const when = (iso: string) => {
  try { return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); }
  catch { return iso.slice(0, 10); }
};

export function ClaimsWaiting({ claims, decide }: {
  claims: WaitingClaim[];
  decide: (input: { kind: AssistedKind; claimId: string; decision: "approve" | "reject"; note: string | null }) =>
    Promise<{ ok: boolean; reason?: string; found?: string[]; error?: string }>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<Record<string, string>>({});

  if (!claims.length) {
    return (
      <div className="rounded-2xl border border-line bg-sand/40 p-5">
        <p className="text-sm text-ink-soft">
          Nothing waiting. When somebody asks to take over a listing or Hub we added for them, their request appears here
          for you to decide.
        </p>
      </div>
    );
  }

  const act = async (c: WaitingClaim, decision: "approve" | "reject", note: string | null) => {
    setBusy(c.claim_id);
    setProblem((p) => ({ ...p, [c.claim_id]: "" }));
    const r = await decide({ kind: c.claim_kind, claimId: c.claim_id, decision, note });
    setBusy(null);
    if (!r.ok) {
      const msg = r.reason === "has_private_history"
        ? `This Hub holds ${(r.found ?? []).join(", ")}. A claimant must not inherit records they were not part of, so the handover was refused. Deal with that history first.`
        : r.reason === "already_owned"
          ? "Somebody already owns this one."
          : (r.error ?? "The decision could not be recorded.");
      setProblem((p) => ({ ...p, [c.claim_id]: msg }));
    }
  };

  return (
    <ul className="space-y-3" aria-label="Requests to take over a record">
      {claims.map((c) => {
        const history = c.private_history ?? [];
        return (
          <li key={c.claim_id} className="rounded-2xl border border-line-strong bg-white p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="text-base font-bold text-ink">
                {c.subject_path ? <a className="underline" href={c.subject_path}>{c.subject_name ?? "Untitled"}</a> : (c.subject_name ?? "Untitled")}
              </h4>
              <span className="rounded-pill bg-amber-100 px-3 py-0.5 text-xs font-bold text-amber-900">
                {c.claim_kind === "hub" ? "Hub" : "Directory listing"} · asked {when(c.created_at)}
              </span>
            </div>

            <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <div><dt className="inline font-semibold text-ink">Who </dt><dd className="inline text-ink-soft">{c.claimant_name ?? "unnamed"}{c.claimant_role ? ` · ${c.claimant_role}` : ""}</dd></div>
              <div><dt className="inline font-semibold text-ink">They gave </dt><dd className="inline text-ink-soft">{c.claimant_email ?? "—"}{c.claimant_phone ? ` · ${c.claimant_phone}` : ""}</dd></div>
              <div><dt className="inline font-semibold text-ink">Account </dt><dd className="inline text-ink-soft">{c.claimant_account_email ?? "—"}</dd></div>
              <div>
                <dt className="inline font-semibold text-ink">Invitation </dt>
                <dd className="inline text-ink-soft">
                  {c.invite_slug
                    ? `${c.invite_sent_at ? `sent ${when(c.invite_sent_at)}` : "never sent"} · fetched ${c.invite_fetch_count ?? 0}×`
                    : "none — they came another way"}
                </dd>
              </div>
              {c.evidence && (
                <div className="sm:col-span-2">
                  <dt className="font-semibold text-ink">How they say we can check</dt>
                  <dd className="mt-1 whitespace-pre-wrap rounded-xl bg-sand/60 px-3 py-2 text-ink-soft">{c.evidence}</dd>
                </div>
              )}
            </dl>

            {c.email_matches_invite === true && (
              <p className="mt-3 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-900">
                The address they gave matches the one the invitation went to. That is a hint, not proof — an invitation
                can be forwarded, so check the connection itself.
              </p>
            )}
            {c.email_matches_invite === false && c.invite_slug && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                The address they gave is <strong>not</strong> the one the invitation went to. Often that is simply a
                colleague, but it is worth asking.
              </p>
            )}
            {history.length > 0 && (
              <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-900">
                This Hub holds {history.join(", ")}. The handover will be refused: a claimant must not inherit members,
                donors or payments they were never part of.
              </p>
            )}
            {problem[c.claim_id] && (
              <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-900">{problem[c.claim_id]}</p>
            )}

            <form
              className="mt-4 space-y-3 rounded-xl border border-line bg-sand/30 p-3"
              onSubmit={(e) => e.preventDefault()}
            >
              <label className="block text-sm font-semibold text-ink" htmlFor={`note-${c.claim_id}`}>
                What you checked <span className="font-normal text-ink-soft">(kept with the claim, not shown to them)</span>
              </label>
              <textarea id={`note-${c.claim_id}`} name="note" rows={2} className="auth-input w-full"
                placeholder="e.g. Rang the number on the page on 21 November; she is the secretary." />
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={busy === c.claim_id || history.length > 0}
                  onClick={(e) => {
                    const form = (e.currentTarget.closest("form") as HTMLFormElement);
                    const note = (form.elements.namedItem("note") as HTMLTextAreaElement)?.value?.trim() || null;
                    void act(c, "approve", note);
                  }}
                  className="min-h-11 rounded-pill bg-navy px-5 text-sm font-bold text-white hover:bg-navy-dark disabled:opacity-50"
                >
                  {busy === c.claim_id ? "Working…" : `Hand ${c.claim_kind === "hub" ? "the Hub" : "the listing"} over`}
                </button>
                <button
                  type="button"
                  disabled={busy === c.claim_id}
                  onClick={(e) => {
                    const form = (e.currentTarget.closest("form") as HTMLFormElement);
                    const note = (form.elements.namedItem("note") as HTMLTextAreaElement)?.value?.trim() || null;
                    void act(c, "reject", note);
                  }}
                  className="min-h-11 rounded-pill border border-line-strong px-5 text-sm font-bold text-ink-soft hover:bg-white disabled:opacity-60"
                >
                  Turn it down
                </button>
              </div>
              <p className="text-xs text-ink-muted">
                Turning it down leaves the page exactly as it is, and we carry on looking after it. Nothing is taken down
                either way.
              </p>
            </form>
          </li>
        );
      })}
    </ul>
  );
}
