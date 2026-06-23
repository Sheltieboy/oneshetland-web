"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BIZ, ALERT_COLORS, type AlertType, type AlertAccess, type PartnerAlert } from "@/lib/business-data";
import { requestAlertAccess, createAlertAddonIntent, sendAlert, cancelAlert } from "@/lib/business-client";

const DURATIONS: { label: string; hours: number | null }[] = [
  { label: "1h", hours: 1 }, { label: "2h", hours: 2 }, { label: "4h", hours: 4 },
  { label: "8h", hours: 8 }, { label: "24h", hours: 24 }, { label: "No expiry", hours: null },
];

export function AlertsManager({ businessId, businessName, access, alerts }: {
  businessId: string; businessName: string; access: AlertAccess | null; alerts: PartnerAlert[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<AlertType>("info");
  const [message, setMessage] = useState("");
  const [hours, setHours] = useState<number | null>(4);
  const live = alerts.filter((a) => a.is_active);

  async function request() { setBusy("req"); setError(null); try { await requestAlertAccess(businessId); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed."); } finally { setBusy(null); } }
  async function activate() {
    setBusy("act"); setError(null);
    try { await createAlertAddonIntent(businessId); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed."); } finally { setBusy(null); }
  }
  async function send() {
    if (!message.trim()) return setError("Write a message.");
    setBusy("send"); setError(null);
    try {
      await sendAlert({ businessId, businessName, message: message.trim(), type, expiresAt: hours ? new Date(Date.now() + hours * 3600_000) : null });
      setMessage(""); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not send."); } finally { setBusy(null); }
  }
  async function cancel(id: string) { try { await cancelAlert(id); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed."); } }

  const card = "rounded-card border border-line bg-paper p-5 shadow-soft";

  if (!access) return (
    <div className={card}>
      <p className="font-bold text-ink">📣 Urgent alerts</p>
      <p className="mt-1 text-sm text-ink-muted">Push urgent messages — ferry updates, road closures, event changes — to every OneShetland user. Requires approval and a £10/month add-on.</p>
      {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
      <button onClick={request} disabled={busy === "req"} className="mt-3 rounded-pill px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BIZ }}>{busy === "req" ? "…" : "Request access"}</button>
    </div>
  );
  if (access.status === "requested") return <div className={card}><p className="font-bold text-ink">⏳ Request under review</p><p className="mt-1 text-sm text-ink-muted">Your request is with OneShetland. You&apos;ll be notified once approved.</p></div>;
  if (access.status === "rejected" || access.status === "suspended") return <div className={card}><p className="font-bold text-ink">Alerts unavailable</p><p className="mt-1 text-sm text-ink-muted">Your alert access is {access.status}. Contact OneShetland for help.</p></div>;
  if (access.status === "approved") return (
    <div className={card}>
      <p className="font-bold text-ink">✅ Approved!</p>
      <p className="mt-1 text-sm text-ink-muted">Activate the £10/month add-on to start sending alerts.</p>
      {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
      <button onClick={activate} disabled={busy === "act"} className="mt-3 rounded-pill px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BIZ }}>{busy === "act" ? "…" : "Activate — £10/month"}</button>
    </div>
  );

  // active
  return (
    <div className="space-y-5">
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {live.length > 0 && (
        <section className={card}>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-ink-muted">Live now</p>
          {live.map((a) => {
            const c = ALERT_COLORS[a.type];
            return (
              <div key={a.id} className="flex items-start justify-between gap-3 border-t border-line py-2.5 first:border-t-0">
                <div className="min-w-0"><span className="rounded-pill px-2 py-0.5 text-[11px] font-bold" style={{ background: c.bg, color: c.color }}>{c.icon} {c.label}</span><p className="mt-1 text-sm text-ink">{a.message}</p></div>
                <button onClick={() => cancel(a.id)} className="shrink-0 rounded-pill border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50">Stop</button>
              </div>
            );
          })}
        </section>
      )}
      <section className={card}>
        <p className="mb-2 font-display text-lg font-bold text-ink">Broadcast an alert</p>
        <div className="flex gap-2">
          {(["emergency", "disruption", "info"] as AlertType[]).map((t) => {
            const c = ALERT_COLORS[t];
            return <button key={t} onClick={() => setType(t)} className="flex-1 rounded-pill border px-3 py-2 text-sm font-semibold transition" style={type === t ? { background: c.bg, color: c.color, borderColor: c.color } : { borderColor: "var(--color-line-strong)", color: "var(--color-ink-soft)" }}>{c.icon} {c.label}</button>;
          })}
        </div>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={200} placeholder="What's happening? (max 200 chars)" className="mt-3 min-h-[80px] w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-ink shadow-soft outline-none" />
        <div className="mt-2 flex flex-wrap gap-2">
          {DURATIONS.map((d) => <button key={d.label} onClick={() => setHours(d.hours)} className={"rounded-pill border px-3 py-1.5 text-xs font-semibold transition " + (hours === d.hours ? "text-white" : "border-line-strong text-ink-soft hover:bg-sand")} style={hours === d.hours ? { background: BIZ, borderColor: BIZ } : undefined}>{d.label}</button>)}
        </div>
        <button onClick={send} disabled={busy === "send" || !message.trim()} className="mt-3 w-full rounded-pill py-3 font-semibold text-white transition hover:brightness-95 disabled:opacity-50" style={{ background: BIZ }}>{busy === "send" ? "Broadcasting…" : "Broadcast alert"}</button>
      </section>
    </div>
  );
}
