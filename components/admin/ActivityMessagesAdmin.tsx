"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminHideMessage, adminListMessages, adminRestoreMessage } from "@/lib/activities-client";
import { deliveryLine, type AdminMessageRow } from "@/lib/activity-messages";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

/** Staff moderation of organiser messages. Hiding removes the message from every follower's Notification Centre; the message, its text and the reason stay on record. */
export function ActivityMessagesAdmin() {
  const [rows, setRows] = useState<AdminMessageRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reason, setReason] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => { try { setRows(await adminListMessages(null)); setErr(null); } catch (e) { setErr((e as Error).message); } }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  async function act(id: string, hide: boolean) {
    setBusy(id); setErr(null);
    try { if (hide) await adminHideMessage(id, reason[id] ?? ""); else await adminRestoreMessage(id); await load(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  }
  return (
    <div>
      <p className="mb-4 text-sm text-ink-soft">Messages organisers have sent to followers, newest first. <Link href="/admin/activities" className="font-semibold underline">← Regular activities</Link></p>
      {err && <p role="alert" className="mb-3 text-sm font-semibold text-rose-700">{err}</p>}
      {!rows ? <p className="text-sm text-ink-muted">Loading…</p> : rows.length === 0 ? <p className="rounded-card border border-line bg-paper p-5 text-ink-muted">No messages have been sent.</p> : (
        <ul className="space-y-3">
          {rows.map((m) => (
            <li key={m.id} className="rounded-card border border-line bg-paper p-4 shadow-soft">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link href={`/whats-on/regular/${m.activity_slug}`} className="font-display text-base font-bold underline-offset-2 hover:underline">{m.activity_title}</Link>
                <span className="text-xs text-ink-muted">{when(m.created_at)}</span>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-ink">{m.body}</p>
              <p className="mt-1 text-xs text-ink-soft">{deliveryLine(m)}</p>
              {m.hidden_at ? (
                <div className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-950">
                  <strong>Hidden</strong> {when(m.hidden_at)}{m.hidden_reason ? `: ${m.hidden_reason}` : ""}
                  <div className="mt-2"><button type="button" disabled={busy === m.id} onClick={() => void act(m.id, false)} className="rounded-pill border border-rose-300 px-4 py-1.5 text-sm font-bold hover:bg-rose-100 disabled:opacity-40">Restore to inboxes</button></div>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor={`why-${m.id}`}>Reason for hiding</label>
                  <input id={`why-${m.id}`} className="min-w-0 flex-1 rounded-lg border border-line-strong bg-white px-3 py-2 text-sm" placeholder="Reason" required aria-required="true" maxLength={300} value={reason[m.id] ?? ""} onChange={(e) => setReason((r) => ({ ...r, [m.id]: e.target.value }))} />
                  <button type="button" disabled={busy === m.id || !(reason[m.id] ?? "").trim()} onClick={() => void act(m.id, true)} className="rounded-pill border border-rose-300 px-4 py-2 text-sm font-bold text-rose-800 hover:bg-rose-50 disabled:opacity-40">Hide from inboxes</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
