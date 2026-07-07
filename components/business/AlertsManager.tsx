"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BIZ, ALERT_COLORS, type AlertType, type AlertAccess, type PartnerAlert } from "@/lib/business-data";
import { requestAlertAccess, createAlertAddonIntent, sendAlert, cancelAlert, forceExpireAlert } from "@/lib/business-client";
import { PaymentCheckout } from "@/components/payments/PaymentCheckout";

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
  const [secret, setSecret] = useState<string | null>(null);   // PaymentIntent client secret when a card must be collected
  const [scheduleLater, setScheduleLater] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");        // datetime-local value

  async function request() { setBusy("req"); setError(null); try { await requestAlertAccess(businessId); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed."); } finally { setBusy(null); } }
  async function activate() {
    setBusy("act"); setError(null);
    try {
      const res = await createAlertAddonIntent(businessId);
      if (res?.activated) { router.refresh(); return; }          // saved card charged silently
      if (res?.paymentIntent) { setSecret(res.paymentIntent); return; } // no card → collect one
      throw new Error("Could not start activation.");
    } catch (e) { setError(e instanceof Error ? e.message : "Failed."); } finally { setBusy(null); }
  }
  async function send() {
    if (!message.trim()) return setError("Write a message.");
    let scheduledDate: Date | null = null;
    if (scheduleLater) {
      if (!scheduledFor) return setError("Pick a date & time to schedule the alert.");
      scheduledDate = new Date(scheduledFor);
      if (isNaN(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now()) return setError("Pick a future date & time.");
    }
    setBusy("send"); setError(null);
    try {
      // expires_at is relative to when the alert goes live (now, or the scheduled time).
      const base = scheduledDate ? scheduledDate.getTime() : Date.now();
      await sendAlert({
        businessId, businessName, message: message.trim(), type,
        expiresAt: hours ? new Date(base + hours * 3600_000) : null,
        scheduledFor: scheduledDate,
      });
      setMessage(""); setScheduleLater(false); setScheduledFor(""); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not send."); } finally { setBusy(null); }
  }
  async function cancel(id: string) { try { await cancelAlert(id); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed."); } }
  async function forceEnd(id: string) {
    if (!confirm("End this live alert now? It will be removed from the app immediately.")) return;
    setBusy(id); setError(null);
    try { await forceExpireAlert(id); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed."); } finally { setBusy(null); }
  }

  // `nowMs` is set after mount (and ticks each minute) so the date-derived
  // status split stays pure during render and refreshes over time.
  const [nowMs, setNowMs] = useState(0);
  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    const raf = requestAnimationFrame(tick);          // first tick, off the effect's sync path
    const t = setInterval(tick, 60_000);
    return () => { cancelAnimationFrame(raf); clearInterval(t); };
  }, []);

  // Classify an alert for the history list (mirrors the app's alertStatus).
  function statusOf(a: PartnerAlert): "live" | "scheduled" | "ended" {
    if (!a.is_active) {
      if (a.starts_at && new Date(a.starts_at).getTime() > nowMs) return "scheduled";
      return "ended";
    }
    if (a.expires_at && new Date(a.expires_at).getTime() <= nowMs) return "ended";
    return "live";
  }
  const fmt = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  const withStatus = alerts.map((a) => ({ a, s: statusOf(a) }));
  const live = withStatus.filter((x) => x.s === "live");
  const scheduled = withStatus.filter((x) => x.s === "scheduled");
  const ended = withStatus.filter((x) => x.s === "ended");
  // datetime-local min (now, in the browser's tz); empty until mount.
  const minLocal = nowMs ? new Date(nowMs - new Date(nowMs).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : undefined;

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
      {secret ? (
        <div className="mt-3 max-w-md">
          <PaymentCheckout
            clientSecret={secret}
            amountPence={1000}
            payLabel="Pay £10 & activate alerts"
            onPaid={() => { setSecret(null); setTimeout(() => router.refresh(), 1500); }}
            onCancel={() => setSecret(null)}
          />
        </div>
      ) : (
        <button onClick={activate} disabled={busy === "act"} className="mt-3 rounded-pill px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BIZ }}>{busy === "act" ? "…" : "Activate — £10/month"}</button>
      )}
    </div>
  );

  // active
  return (
    <div className="space-y-5">
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <section className={card}>
        <p className="mb-2 font-display text-lg font-bold text-ink">Broadcast an alert</p>
        <div className="flex gap-2">
          {(["emergency", "disruption", "info"] as AlertType[]).map((t) => {
            const c = ALERT_COLORS[t];
            return <button key={t} onClick={() => setType(t)} className="flex-1 rounded-pill border px-3 py-2 text-sm font-semibold transition" style={type === t ? { background: c.bg, color: c.color, borderColor: c.color } : { borderColor: "var(--color-line-strong)", color: "var(--color-ink-soft)" }}>{c.icon} {c.label}</button>;
          })}
        </div>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={200} placeholder="What's happening? (max 200 chars)" className="mt-3 min-h-[80px] w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-ink shadow-soft outline-none" />
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">{scheduleLater ? "Stays live for" : "Expires after"}</p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {DURATIONS.map((d) => <button key={d.label} onClick={() => setHours(d.hours)} className={"rounded-pill border px-3 py-1.5 text-xs font-semibold transition " + (hours === d.hours ? "text-white" : "border-line-strong text-ink-soft hover:bg-sand")} style={hours === d.hours ? { background: BIZ, borderColor: BIZ } : undefined}>{d.label}</button>)}
        </div>
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink-soft">
          <input type="checkbox" checked={scheduleLater} onChange={(e) => { setScheduleLater(e.target.checked); if (!e.target.checked) setScheduledFor(""); }} className="h-4 w-4 rounded border-line-strong" />
          Schedule for later
        </label>
        {scheduleLater && (
          <input type="datetime-local" value={scheduledFor} min={minLocal} onChange={(e) => setScheduledFor(e.target.value)} className="mt-2 w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-ink shadow-soft outline-none" />
        )}
        <button onClick={send} disabled={busy === "send" || !message.trim()} className="mt-3 w-full rounded-pill py-3 font-semibold text-white transition hover:brightness-95 disabled:opacity-50" style={{ background: BIZ }}>{busy === "send" ? (scheduleLater ? "Scheduling…" : "Broadcasting…") : (scheduleLater ? "Schedule alert" : "Broadcast alert")}</button>
      </section>

      {/* History — live, scheduled, ended */}
      <section className={card}>
        <p className="mb-3 font-display text-lg font-bold text-ink">Alert history</p>
        {alerts.length === 0 ? (
          <p className="rounded-card border border-dashed border-line bg-paper/60 px-5 py-6 text-center text-sm text-ink-muted">No alerts yet. Alerts you send appear here.</p>
        ) : (
          <div className="space-y-4">
            {([["LIVE NOW", live, "live"], ["SCHEDULED", scheduled, "scheduled"], ["ENDED / CANCELLED", ended, "ended"]] as const).map(([label, list]) =>
              list.length === 0 ? null : (
                <div key={label}>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-ink-muted">{label}</p>
                  <div className="space-y-2">
                    {list.map(({ a, s }) => {
                      const c = ALERT_COLORS[a.type];
                      return (
                        <div key={a.id} className={"flex items-start justify-between gap-3 rounded-card border border-line p-3 " + (s === "ended" ? "bg-sand/50" : "bg-paper")}>
                          <div className="min-w-0">
                            <span className="rounded-pill px-2 py-0.5 text-[11px] font-bold" style={{ background: s === "ended" ? "var(--color-sand)" : c.bg, color: s === "ended" ? "var(--color-ink-muted)" : c.color }}>{c.icon} {c.label}</span>
                            <p className={"mt-1 text-sm " + (s === "ended" ? "text-ink-muted" : "text-ink")}>{a.message}</p>
                            <p className="mt-1 text-[11px] text-ink-faint">
                              {s === "scheduled" ? `Scheduled for ${fmt(a.starts_at)}`
                                : s === "live" ? `Live · ${a.expires_at ? `expires ${fmt(a.expires_at)}` : "no expiry"}`
                                : `Sent ${fmt(a.created_at)}${a.expires_at ? ` · ended ${fmt(a.expires_at)}` : ""}`}
                            </p>
                          </div>
                          {s === "live" && <button onClick={() => forceEnd(a.id)} disabled={busy === a.id} className="shrink-0 rounded-pill border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50">{busy === a.id ? "…" : "End now"}</button>}
                          {s === "scheduled" && <button onClick={() => cancel(a.id)} className="shrink-0 rounded-pill border border-line-strong px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-sand">Delete</button>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </section>
    </div>
  );
}
