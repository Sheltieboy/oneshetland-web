"use client";
/**
 * AssistedRecords — what OneShetland has created on somebody's behalf, and where each one stands.
 *
 * The state line is the point: OneShetland-managed, unclaimed, or managed by its owner. That is the
 * distinction Phase 2's invitations act on, and it is read from the content row itself (is_claimed /
 * owner) rather than from anything this feature stores, so it cannot drift out of step with reality.
 */
import { useState } from "react";
import { assistedState, publicPath, type AssistedKind, type AssistedRow } from "@/lib/assisted/shape";

type Props = {
  rows: AssistedRow[];
  kind: AssistedKind;
  forget: (input: { kind: AssistedKind; id: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
};

const when = (iso: string) => {
  try { return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); }
  catch { return iso.slice(0, 10); }
};

export function AssistedRecords({ rows, kind, forget }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
                  className="mt-3 text-sm font-bold text-navy hover:underline disabled:opacity-60"
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
