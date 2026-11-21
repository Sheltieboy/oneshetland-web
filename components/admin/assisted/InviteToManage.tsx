"use client";
/**
 * InviteToManage — the invitation half of an assisted record, inside the record's own card.
 *
 * Three things this screen is careful about:
 *
 *   1. THE LINK IS SHOWN ONCE. The database stores only a SHA-256 of the token, so when this panel
 *      is dismissed the link is gone for good. The screen says so, rather than letting Darren find
 *      out later.
 *   2. "LINK FETCHED" IS NOT "READ". Email security scanners prefetch links. The status chip says
 *      fetched, and the explanation under it says why that is not proof anybody saw it.
 *   3. NOTHING IS SENT BY ACCIDENT. Generating is one button, sending is another, and a record
 *      created in Phase 1 never sends anything at all.
 */
import { useState } from "react";
import type { InviteRow } from "@/lib/assisted/invites.server";
import { INVITE_STATUS_MEANING, type InviteStatus } from "@/lib/assisted/invites";
import type { AssistedKind } from "@/lib/assisted/shape";
import type { AuditLine } from "@/lib/assisted/invites.server";
import type { IssueResult } from "@/app/admin/assisted/actions";

const when = (iso: string | null) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return iso.slice(0, 10); }
};

const CHIP: Record<InviteStatus, string> = {
  prepared: "bg-sand text-ink-soft",
  sent: "bg-sky-100 text-sky-900",
  "link fetched": "bg-indigo-100 text-indigo-900",
  "claim requested": "bg-amber-100 text-amber-900",
  approved: "bg-emerald-100 text-emerald-900",
  rejected: "bg-rose-100 text-rose-900",
  declined: "bg-rose-50 text-rose-900",
  expired: "bg-sand text-ink-muted",
  revoked: "bg-sand text-ink-muted",
};

type Props = {
  kind: AssistedKind;
  subjectId: string;
  subjectName: string;
  subjectSlug: string | null;
  invites: InviteRow[];
  issue: (form: FormData) => Promise<IssueResult>;
  markSent: (input: { slug: string; via: "email" | "copied" }) => Promise<{ ok: boolean; reason?: string; error?: string }>;
  revoke: (input: { slug: string; reason: string | null }) => Promise<{ ok: boolean; error?: string }>;
  audit: (slug: string) => Promise<AuditLine[]>;
  /** Asks the Edge Function to send it. The web app itself has no mail transport. */
  sendEmail: (input: { link: string; confirm: boolean; recipient: string }) => Promise<{ ok: true; id: string } | { ok: false; error: string; uncertain?: true }>;
};

export function InviteToManage({ kind, subjectId, subjectName, subjectSlug, invites, issue, markSent, revoke, audit, sendEmail }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<Extract<IssueResult, { issued: true }> | null>(null);
  const [copied, setCopied] = useState(false);
  const [declinedBlock, setDeclinedBlock] = useState(false);
  const [trail, setTrail] = useState<{ slug: string; lines: AuditLine[] } | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const live = invites.find((i) => !["revoked", "expired", "declined"].includes(i.status)) ?? invites[0] ?? null;
  const noun = kind === "hub" ? "Hub" : "listing";

  const generate = async (form: FormData, override: boolean) => {
    form.set("kind", kind); form.set("id", subjectId);
    form.set("subject_name", subjectName); form.set("subject_slug", subjectSlug ?? "");
    if (override) form.set("override_declined", "on");
    setBusy(true); setError(null); setDeclinedBlock(false);
    const r = await issue(form);
    setBusy(false);
    if (r.issued) { setIssued(r); setOpen(false); return; }
    if (r.reason === "previously_declined") { setDeclinedBlock(true); return; }
    setError(r.error);
  };

  return (
    <div className="mt-4 rounded-xl border border-line bg-sand/30 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h5 className="text-sm font-bold text-ink">Invitation to manage</h5>
        {live && (
          <span className={`rounded-pill px-3 py-0.5 text-xs font-bold ${CHIP[live.status] ?? "bg-sand text-ink-soft"}`}>
            {live.status}
          </span>
        )}
      </div>

      {!invites.length && (
        <p className="mt-2 text-sm text-ink-soft">
          Nobody has been invited. Creating this {noun} sent nothing and told nobody.
        </p>
      )}

      {live && (
        <div className="mt-2 space-y-2 text-sm">
          <p className="text-ink-soft">{INVITE_STATUS_MEANING[live.status]}</p>
          <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            <div><dt className="inline font-semibold text-ink">Invited </dt><dd className="inline text-ink-soft">{live.invited_email ?? "nobody in particular"}{live.invited_name ? ` (${live.invited_name})` : ""}</dd></div>
            <div><dt className="inline font-semibold text-ink">Runs out </dt><dd className="inline text-ink-soft">{when(live.expires_at)}</dd></div>
            <div><dt className="inline font-semibold text-ink">Sent </dt><dd className="inline text-ink-soft">{live.sent_at ? `${when(live.sent_at)}${live.sent_via === "copied" ? " (by you)" : " (by OneShetland)"}${live.send_count > 1 ? ` · ${live.send_count} times` : ""}` : "not yet"}</dd></div>
            <div>
              <dt className="inline font-semibold text-ink">Link fetched </dt>
              <dd className="inline text-ink-soft">
                {live.fetch_count ? `${live.fetch_count} time${live.fetch_count === 1 ? "" : "s"}, last ${when(live.last_fetched_at)}` : "never"}
              </dd>
            </div>
            {live.claim_status && (
              <div className="sm:col-span-2">
                <dt className="inline font-semibold text-ink">Claim </dt>
                <dd className="inline text-ink-soft">{live.claim_status} — {live.claimant_name ?? "unnamed"}{live.claimant_email ? ` · ${live.claimant_email}` : ""}</dd>
              </div>
            )}
            {live.decline_reason && (
              <div className="sm:col-span-2"><dt className="inline font-semibold text-ink">They said </dt><dd className="inline text-ink-soft">{live.decline_reason}</dd></div>
            )}
          </dl>
          {live.do_not_contact && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-900">
              We have been asked not to contact this address. OneShetland will not send to it.
            </p>
          )}
          {live.fetch_count > 0 && (
            <p className="text-xs text-ink-muted">
              A fetch is a request for the address. Mail providers and security scanners follow links before a person
              does, so this is not proof that anybody read it.
            </p>
          )}
        </div>
      )}

      {/* The link, shown once and once only. */}
      {issued && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-bold text-emerald-900">
            Invitation ready{issued.superseded > 0 ? " — and the previous one has been cancelled" : ""}.
          </p>
          <p className="mt-1 text-xs text-emerald-900">
            This is the only time the link is shown. It is not stored anywhere — only a one-way hash of it is — so if you
            lose it you will need to generate another, which cancels this one.
          </p>
          <code className="mt-2 block break-all rounded-lg bg-white px-3 py-2 text-xs text-ink">{issued.link}</code>
          {/* Sending by email is a separate, confirmed step. Generating one sends nothing. */}
          {live?.invited_email && !live.do_not_contact && (
            <div className="mt-3 rounded-lg border border-line bg-white p-3">
              {sent ? (
                <p className="text-sm font-bold text-emerald-900">Sent to {live.invited_email}.</p>
              ) : !confirming ? (
                <button type="button" onClick={() => setConfirming(true)}
                  className="min-h-11 rounded-pill bg-navy px-4 text-sm font-bold text-white hover:bg-navy-dark">
                  Send it from OneShetland…
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-ink-soft">
                    Send this to <strong className="text-ink">{live.invited_email}</strong>? There is no open or click
                    tracking on it, and no marketing list.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true); setError(null);
                        const r = await sendEmail({ link: issued.link, confirm: true, recipient: live.invited_email! });
                        setBusy(false); setConfirming(false);
                        if (r.ok) { setSent(r.id); setIssued(null); }
                        else setError(r.uncertain ? `${r.error}` : r.error);
                      }}
                      className="min-h-11 rounded-pill bg-navy px-4 text-sm font-bold text-white hover:bg-navy-dark disabled:opacity-60"
                    >
                      {busy ? "Sending…" : "Yes, send it"}
                    </button>
                    <button type="button" onClick={() => setConfirming(false)} className="text-sm font-bold text-navy hover:underline">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              className="min-h-11 rounded-pill bg-navy px-4 text-sm font-bold text-white hover:bg-navy-dark"
              onClick={async () => {
                try { await navigator.clipboard.writeText(issued.copy); setCopied(true); }
                catch { setError("Could not reach the clipboard. Select the message below and copy it."); }
              }}
            >
              {copied ? "Copied — now paste it into your email" : "Copy the whole message"}
            </button>
            <button
              type="button"
              disabled={busy}
              className="min-h-11 rounded-pill border border-line-strong px-4 text-sm font-bold text-ink-soft hover:bg-white disabled:opacity-60"
              onClick={async () => {
                setBusy(true); setError(null);
                const r = await markSent({ slug: issued.slug, via: "copied" });
                setBusy(false);
                if (!r.ok) setError(r.reason === "do_not_contact" ? "That address is on the do-not-contact list." : (r.error ?? "Could not record that."));
                else setIssued(null);
              }}
            >
              I have sent it myself
            </button>
            <button type="button" className="text-sm font-bold text-navy hover:underline" onClick={() => setIssued(null)}>
              Dismiss (the link is lost)
            </button>
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-bold text-emerald-900">See the message</summary>
            <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs text-ink">{issued.copy}</pre>
          </details>
        </div>
      )}

      {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-900">{error}</p>}

      {declinedBlock && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-bold text-amber-900">They have already said no thanks.</p>
          <p className="mt-1 text-xs text-amber-900">
            We do not invite somebody again by accident. If you have a reason to ask once more, say so and it will be
            recorded against the invitation.
          </p>
          <form
            className="mt-2"
            onSubmit={async (e) => { e.preventDefault(); await generate(new FormData(e.currentTarget), true); }}
          >
            <input type="hidden" name="days" value="30" />
            <button type="submit" disabled={busy} className="min-h-11 rounded-pill bg-navy px-4 text-sm font-bold text-white disabled:opacity-60">
              {busy ? "Generating…" : "Invite them again anyway"}
            </button>
          </form>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-4">
        {!open && (
          <button type="button" onClick={() => { setOpen(true); setError(null); }} className="text-sm font-bold text-navy hover:underline">
            {live && !["revoked", "expired", "declined"].includes(live.status) ? "Replace the invitation…" : "Invite to manage…"}
          </button>
        )}
        {live && !["revoked", "expired", "declined", "approved"].includes(live.status) && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true); setError(null);
              const r = await revoke({ slug: live.slug, reason: null });
              setBusy(false);
              if (!r.ok) setError(r.error ?? "Could not cancel it.");
            }}
            className="text-sm font-bold text-navy hover:underline disabled:opacity-60"
          >
            Cancel the invitation
          </button>
        )}
        {invites.length > 0 && (
          <button
            type="button"
            onClick={async () => {
              const slug = (live ?? invites[0]).slug;
              setTrail({ slug, lines: await audit(slug) });
            }}
            className="text-sm font-bold text-navy hover:underline"
          >
            See the audit trail
          </button>
        )}
      </div>

      {open && (
        <form
          className="mt-3 space-y-3 rounded-xl border border-line bg-white p-4"
          onSubmit={async (e) => { e.preventDefault(); await generate(new FormData(e.currentTarget), false); }}
        >
          <p className="text-sm text-ink-soft">
            This generates a private link. <strong className="text-ink">It sends nothing.</strong> You can copy the message
            and send it from your own email, and nobody has an account created for them either way.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-ink" htmlFor={`iv-name-${subjectId}`}>Their name <span className="font-normal text-ink-soft">(optional)</span></label>
              <input id={`iv-name-${subjectId}`} name="invited_name" className="auth-input w-full" defaultValue={live?.invited_name ?? ""} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink" htmlFor={`iv-email-${subjectId}`}>Their email <span className="font-normal text-ink-soft">(optional)</span></label>
              <input id={`iv-email-${subjectId}`} name="invited_email" type="email" className="auth-input w-full" defaultValue={live?.invited_email ?? ""} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink" htmlFor={`iv-days-${subjectId}`}>Runs out after</label>
              <select id={`iv-days-${subjectId}`} name="days" className="auth-input w-full" defaultValue="30">
                <option value="14">a fortnight</option>
                <option value="30">30 days</option>
                <option value="60">60 days</option>
                <option value="120">120 days (the longest allowed)</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={busy} className="min-h-11 rounded-pill bg-navy px-5 text-sm font-bold text-white hover:bg-navy-dark disabled:opacity-60">
              {busy ? "Generating…" : "Generate the invitation"}
            </button>
            <button type="button" onClick={() => { setOpen(false); setError(null); }} className="text-sm font-bold text-navy hover:underline">Cancel</button>
          </div>
        </form>
      )}

      {trail && (
        <div className="mt-3 rounded-xl border border-line bg-white p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h6 className="text-sm font-bold text-ink">Audit trail</h6>
            <button type="button" onClick={() => setTrail(null)} className="text-xs font-bold text-navy hover:underline">Close</button>
          </div>
          {!trail.lines.length ? (
            <p className="mt-2 text-sm text-ink-soft">Nothing recorded yet.</p>
          ) : (
            <ol className="mt-2 space-y-1.5 text-sm">
              {trail.lines.map((l, i) => (
                <li key={`${l.at}-${i}`} className="flex flex-wrap gap-x-2 text-ink-soft">
                  <span className="font-mono text-xs text-ink-muted">{new Date(l.at).toLocaleString("en-GB")}</span>
                  <span className="font-semibold text-ink">{l.action.replace(/_/g, " ")}</span>
                  <span>{l.actor_name ?? (l.actor_via === "recipient" ? "the recipient" : l.actor_via ?? "")}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
