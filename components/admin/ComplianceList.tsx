"use client";

import { useState } from "react";

const EVENT_LABEL: Record<string, string> = {
  "email.verified": "Email verified", "terms.accepted": "Terms accepted", "privacy.accepted": "Privacy policy accepted",
  "fetch.liability_ack": "Fetch liability acknowledged", "driver.terms_accepted": "Driver terms accepted",
  "marketing.opted_in": "Marketing opted in", "marketing.opted_out": "Marketing opted out",
  "data.export_requested": "Data export requested", "account.deletion_req": "Account deletion requested",
  "age.confirmed": "Age (16+) confirmed", "booking.terms_accepted": "Booking terms accepted",
  "payment.method_added": "Payment method added", "password.changed": "Password changed", "email.changed": "Email changed",
};

export type ComplianceRow = {
  id: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  event_type: string;
  document_version: string | null;
  description: string | null;
  ip_address: string | null;
  device_info: string | null;
  app_version: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line py-1.5 last:border-0">
      <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">{label}</span>
      <span className="select-all break-all text-right text-sm text-ink">{value}</span>
    </div>
  );
}

export function ComplianceList({ rows }: { rows: ComplianceRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="rounded-card border border-line bg-paper p-4 shadow-soft">
      <p className="mb-3 text-sm text-ink-muted">{rows.length} record{rows.length === 1 ? "" : "s"} for <b className="text-ink">{rows[0].user_name ?? rows[0].user_email}</b></p>
      <ol className="divide-y divide-line">
        {rows.map((r) => {
          const isOpen = openId === r.id;
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : r.id)}
                className="flex w-full items-start justify-between gap-4 py-3 text-left"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{EVENT_LABEL[r.event_type] ?? r.event_type}{r.document_version ? ` · v${r.document_version}` : ""}</p>
                  {r.description && <p className="text-sm text-ink-muted">{r.description}</p>}
                </div>
                <span className="flex shrink-0 items-center gap-2 text-xs text-ink-faint">
                  {new Date(r.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  <span className={"transition-transform " + (isOpen ? "rotate-180" : "")} aria-hidden>▾</span>
                </span>
              </button>
              {isOpen && (
                <div className="mb-3 rounded-lg bg-sand/50 px-4 py-3">
                  <DetailRow label="Record ID" value={r.id} />
                  <DetailRow label="User ID" value={r.user_id ?? "—"} />
                  <DetailRow label="Email" value={r.user_email ?? "—"} />
                  <DetailRow label="Name" value={r.user_name ?? "—"} />
                  <DetailRow label="Event" value={r.event_type} />
                  <DetailRow label="Version" value={r.document_version ?? "—"} />
                  <DetailRow label="Description" value={r.description ?? "—"} />
                  <DetailRow label="IP address" value={r.ip_address ?? "—"} />
                  <DetailRow label="Device" value={r.device_info ?? "—"} />
                  <DetailRow label="App version" value={r.app_version ?? "—"} />
                  <DetailRow label="Timestamp" value={new Date(r.created_at).toISOString()} />
                  {r.metadata && Object.keys(r.metadata).length > 0 && (
                    <div className="border-b border-line py-1.5 last:border-0">
                      <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">Metadata</span>
                      <pre className="mt-1 select-all overflow-x-auto whitespace-pre-wrap break-all text-xs text-ink">{JSON.stringify(r.metadata, null, 2)}</pre>
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-violet-700">
                    <span aria-hidden>🔒</span> This record is immutable — it cannot be edited or deleted.
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
