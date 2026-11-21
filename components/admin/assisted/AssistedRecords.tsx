"use client";
/**
 * AssistedRecords — what OneShetland has created on somebody's behalf, and where each one stands.
 *
 * The state line is the point: OneShetland-managed, unclaimed, or managed by its owner. That is the
 * distinction Phase 2's invitations act on, and it is read from the content row itself (is_claimed /
 * owner) rather than from anything this feature stores, so it cannot drift out of step with reality.
 */
import { useState } from "react";
import { assistedState, BUSINESS_CATEGORIES, HUB_TYPES, publicPath, type AssistedKind, type AssistedRow } from "@/lib/assisted/shape";
import { InviteToManage } from "./InviteToManage";
import { ContinuedHelp } from "./ContinuedHelp";
import type { AuditLine, InviteRow, SupportEdit, SupportState } from "@/lib/assisted/invites.server";
import type { IssueResult } from "@/app/admin/assisted/actions";

type Props = {
  rows: AssistedRow[];
  kind: AssistedKind;
  forget: (input: { kind: AssistedKind; id: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
  edit: (form: FormData) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Phase 2 — every invitation for these records, already read on the server. */
  invites: InviteRow[];
  issue: (form: FormData) => Promise<IssueResult>;
  markSent: (input: { slug: string; via: "email" | "copied" }) => Promise<{ ok: boolean; reason?: string; by?: string; error?: string }>;
  revoke: (input: { slug: string; reason: string | null }) => Promise<{ ok: boolean; error?: string }>;
  audit: (slug: string) => Promise<AuditLine[]>;
  sendEmail: (input: { link: string; confirm: boolean; recipient: string }) => Promise<{ ok: true; id: string } | { ok: false; error: string; uncertain?: true }>;
  liftContactPreference: (input: { email: string; reason: string }) => Promise<{ ok: boolean; lifted?: number; error?: string }>;
  supportState: (input: { kind: AssistedKind; id: string }) => Promise<SupportState>;
  recordSupport: (input: { kind: AssistedKind; id: string; days: number; note: string }) => Promise<{ ok: boolean; error?: string }>;
  endSupport: (input: { kind: AssistedKind; id: string; reason: string | null }) => Promise<{ ok: boolean; error?: string }>;
  supportLog: (input: { kind: AssistedKind; id: string }) => Promise<SupportEdit[]>;
};

const when = (iso: string) => {
  try { return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); }
  catch { return iso.slice(0, 10); }
};

export function AssistedRecords({ rows, kind, forget, edit, invites, issue, markSent, revoke, audit, sendEmail, liftContactPreference, supportState, recordSupport, endSupport, supportLog }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const noun = kind === "hub" ? "Hubs" : "listings";

  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-line bg-sand/40 p-5">
        <p className="text-sm text-ink-soft">Nothing yet. {noun === "Hubs" ? "Hubs" : "Listings"} you add on an organisation’s behalf appear here, with whether anybody has claimed them.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900">{error}</p>}
      <ul className="space-y-3" aria-label={`Added on behalf of others — ${noun}`}>
        {rows.map((r) => {
          const path = publicPath(r);
          return (
            <li key={`${r.subject_kind}:${r.subject_id}`} className="rounded-2xl border border-line-strong bg-white p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="text-base font-bold text-ink">
                  {path ? <a className="underline" href={path}>{r.subject_name ?? "Untitled"}</a> : (r.subject_name ?? "Untitled")}
                </h4>
                <span className={"rounded-pill px-3 py-0.5 text-xs font-bold " + (r.is_claimed ? "bg-emerald-100 text-emerald-900" : r.is_active ? "bg-sky-100 text-sky-900" : "bg-sand text-ink-soft")}>
                  {r.is_claimed ? "Organisation-managed" : r.is_active ? "OneShetland-managed" : "Unpublished"}
                </span>
              </div>
              <p className="mt-1 text-sm text-ink-soft">{assistedState(r)}</p>
              <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                <div><dt className="inline font-semibold text-ink">Added </dt><dd className="inline text-ink-soft">{when(r.created_at)}{r.created_by_name ? ` by ${r.created_by_name}` : ""}</dd></div>
                <div>
                  <dt className="inline font-semibold text-ink">Asked by </dt>
                  <dd className="inline text-ink-soft">
                    {r.contact_forgotten ? <em>contact details removed</em>
                      : r.requested_by_name || r.requested_by_email
                        ? `${r.requested_by_name ?? ""}${r.requested_by_name && r.requested_by_email ? " · " : ""}${r.requested_by_email ?? ""}`
                        : <em>not recorded</em>}
                  </dd>
                </div>
                {r.request_note && <div className="sm:col-span-2"><dt className="inline font-semibold text-ink">Note </dt><dd className="inline text-ink-soft">{r.request_note}</dd></div>}
              </dl>
              {editing === r.subject_id && !r.is_claimed && (
                <form
                  className="mt-4 space-y-3 rounded-xl border border-line bg-sand/40 p-4"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = new FormData(e.currentTarget);
                    form.set("kind", r.subject_kind);
                    form.set("id", r.subject_id);
                    setBusy(r.subject_id); setError(null);
                    const res = await edit(form);
                    if (!res.ok) setError(res.error); else setEditing(null);
                    setBusy(null);
                  }}
                >
                  <p className="text-sm text-ink-soft">Leave a field blank to keep what is already there. Only an unclaimed record can be edited here — once somebody claims it, they are in charge.</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-semibold text-ink" htmlFor={`e-name-${r.subject_id}`}>Name</label>
                      <input id={`e-name-${r.subject_id}`} name="name" defaultValue={r.subject_name ?? ""} className="auth-input w-full" />
                    </div>
                    {r.subject_kind === "business" ? (
                      <>
                        <div>
                          <label className="block text-sm font-semibold text-ink" htmlFor={`e-cat-${r.subject_id}`}>Category</label>
                          <select id={`e-cat-${r.subject_id}`} name="category" className="auth-input w-full" defaultValue="">
                            <option value="">Leave as it is</option>
                            {BUSINESS_CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-ink" htmlFor={`e-addr-${r.subject_id}`}>Address or place</label>
                          <input id={`e-addr-${r.subject_id}`} name="address" className="auth-input w-full" placeholder="Leave blank to keep it" />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="block text-sm font-semibold text-ink" htmlFor={`e-type-${r.subject_id}`}>Kind of organisation</label>
                          <select id={`e-type-${r.subject_id}`} name="type" className="auth-input w-full" defaultValue="">
                            <option value="">Leave as it is</option>
                            {HUB_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-ink" htmlFor={`e-area-${r.subject_id}`}>Area</label>
                          <input id={`e-area-${r.subject_id}`} name="area" className="auth-input w-full" placeholder="Leave blank to keep it" />
                        </div>
                      </>
                    )}
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-semibold text-ink" htmlFor={`e-desc-${r.subject_id}`}>Description</label>
                      <textarea id={`e-desc-${r.subject_id}`} name="description" rows={2} className="auth-input w-full" placeholder="Leave blank to keep it" />
                    </div>
                  </div>
                  <label className="flex items-center gap-3 text-sm text-ink">
                    <input type="checkbox" name="publish" defaultChecked={!!r.is_active} className="size-4" />
                    <span>Visible to the public</span>
                  </label>
                  <div className="flex gap-3">
                    <button type="submit" disabled={busy === r.subject_id} className="min-h-11 rounded-pill bg-navy px-5 text-sm font-bold text-white hover:bg-navy-dark disabled:opacity-60">
                      {busy === r.subject_id ? "Saving…" : "Save changes"}
                    </button>
                    <button type="button" onClick={() => { setEditing(null); setError(null); }} className="text-sm font-bold text-navy hover:underline">Cancel</button>
                  </div>
                </form>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-4">
                {!r.is_claimed && editing !== r.subject_id && (
                  <button type="button" onClick={() => { setEditing(r.subject_id); setError(null); }} className="text-sm font-bold text-navy hover:underline">
                    Edit the details
                  </button>
                )}
                {r.is_claimed && <p className="text-sm text-ink-muted">Claimed — only its owner can edit it, unless they ask us to help.</p>}
              </div>

              {/* Phase 2. An unclaimed record can be offered to its organisation; a claimed one cannot
                  be edited here unless its owner has asked us to keep helping. */}
              {!r.is_claimed ? (
                <InviteToManage
                  kind={r.subject_kind}
                  subjectId={r.subject_id}
                  subjectName={r.subject_name ?? "this organisation"}
                  subjectSlug={r.slug}
                  invites={invites.filter((i) => i.subject_id === r.subject_id)}
                  issue={issue}
                  markSent={markSent}
                  revoke={revoke}
                  audit={audit}
                  sendEmail={sendEmail}
                  liftContactPreference={liftContactPreference}
                />
              ) : (
                <ContinuedHelp
                  kind={r.subject_kind}
                  subjectId={r.subject_id}
                  subjectName={r.subject_name ?? "this organisation"}
                  readState={supportState}
                  record={recordSupport}
                  end={endSupport}
                  log={supportLog}
                />
              )}

              {!r.contact_forgotten && (r.requested_by_email || r.requested_by_name) && (
                <button
                  type="button"
                  disabled={busy === r.subject_id}
                  onClick={async () => {
                    setBusy(r.subject_id); setError(null);
                    const res = await forget({ kind: r.subject_kind, id: r.subject_id });
                    if (!res.ok) setError(res.error);
                    setBusy(null);
                  }}
                  className="text-sm font-bold text-navy hover:underline disabled:opacity-60"
                >
                  {busy === r.subject_id ? "Removing…" : "Remove their contact details"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-ink-muted">Contact details are held only so you can offer management access later. Removing them keeps the record that we added this on request.</p>
    </div>
  );
}
