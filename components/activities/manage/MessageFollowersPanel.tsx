"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getMessagingStatus, listActivityMessages, sendActivityMessage } from "@/lib/activities-client";
import { MESSAGE_MAX, deliveryLine, messageProblem, cleanMessage, type MessageRow, type MessagingStatus } from "@/lib/activity-messages";
import { btnGhost, btnPrimary, card, hint, input, label } from "./ui";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
const newId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`.padEnd(36, "0"));

/**
 * Message followers. The organiser writes a short plain-text message; the database function checks who they are, that the activity is public, the
 * text rules and the limits, then delivers it to followers' Notification Centre in one transaction. This panel never learns who follows: only how many.
 * A request id is made once per composed message and reused on any retry, so a double click or a dropped connection cannot send it twice.
 */
export function MessageFollowersPanel({ activityId }: { activityId: string }) {
  const [status, setStatus] = useState<MessagingStatus | null>(null);
  const [history, setHistory] = useState<MessageRow[] | null>(null);
  const [text, setText] = useState("");
  const [step, setStep] = useState<"write" | "confirm">("write");
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const requestId = useRef<string>(newId());
  const sending = useRef(false);

  const load = useCallback(async () => {
    try { const [s, h] = await Promise.all([getMessagingStatus(activityId), listActivityMessages(activityId)]); setStatus(s); setHistory(h); setLoadErr(null); }
    catch (e) { setLoadErr((e as Error).message); }
  }, [activityId]);
  // Reads after the page has loaded: the signed-in person's own view, never rendered on the server.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const cleaned = cleanMessage(text);
  const problem = messageProblem(cleaned);
  const chars = [...text].length;
  const canCompose = !!status && status.eligible && status.followers > 0;
  const nextAt = status?.next_allowed_at ? new Date(status.next_allowed_at) : null;
  const waiting = !!nextAt;   // the database only reports a slot that is still in the future; it re-checks on send anyway

  async function send() {
    if (sending.current) return;           // a second click while one is in flight does nothing
    sending.current = true; setBusy(true); setMsg(null);
    try {
      const r = await sendActivityMessage(activityId, cleaned, requestId.current);
      setMsg({ tone: "ok", text: `Message sent. ${deliveryLine(r)}` });
      setText(""); setStep("write"); setTouched(false); requestId.current = newId();
      await load();
    } catch (e) {
      setMsg({ tone: "err", text: (e as Error).message }); setStep("write"); await load();
    } finally { sending.current = false; setBusy(false); }
  }

  return (
    <section className={card} aria-labelledby="msg-h" data-message-followers>
      <h2 id="msg-h" className="font-display text-lg font-bold">Message followers</h2>
      {loadErr && <p role="alert" className="mt-2 text-sm font-semibold text-rose-700">{loadErr}</p>}
      {!status && !loadErr && <p className="mt-2 text-sm text-ink-muted" role="status">Loading…</p>}

      {status && (
        <>
          <p className="mt-1 text-sm text-ink-soft">
            {status.followers === 0 ? "Nobody follows this activity yet." : <><strong className="text-ink">{status.followers}</strong> {status.followers === 1 ? "person follows" : "people follow"} this activity.</>}{" "}
            Followers get your message in their OneShetland notifications. You can see how many, never who.
          </p>

          {!status.eligible && <p role="status" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{status.reason}</p>}
          {status.eligible && status.followers === 0 && (
            <p className="mt-3 rounded-lg bg-sand p-3 text-sm text-ink-soft">Followers are people who tap Follow on your activity page. Once someone does, you can write to them here. Ask people at your sessions to follow so they hear about changes and news.</p>
          )}

          {canCompose && (
            <div className="mt-4">
              {step === "write" ? (
                <>
                  <label className={label} htmlFor="msg-text">Your message</label>
                  <textarea id="msg-text" className={input + " mt-1"} rows={4} value={text} maxLength={MESSAGE_MAX + 50} disabled={busy || waiting}
                    onChange={(e) => { setText(e.target.value); setTouched(true); setMsg(null); }}
                    aria-describedby="msg-hint msg-count" aria-invalid={touched && !!problem && cleaned !== ""}
                    placeholder="e.g. Class is back this Thursday after the half-term break. Bring a water bottle." />
                  <div className="mt-1 flex flex-wrap items-start justify-between gap-2">
                    <p id="msg-hint" className={hint + " !mt-0"}>Plain text only. Links, web addresses, email addresses and phone numbers are not allowed. Put contact details on the activity itself.</p>
                    <p id="msg-count" className={"text-xs font-semibold " + (chars > MESSAGE_MAX ? "text-rose-700" : "text-ink-muted")} aria-live="polite">{chars}/{MESSAGE_MAX}</p>
                  </div>
                  {touched && cleaned !== "" && problem && <p role="alert" className="mt-1 text-sm font-semibold text-rose-700">{problem}</p>}
                  {waiting && nextAt && <p role="status" className="mt-2 text-sm text-ink-soft">You can send the next message after {nextAt.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })}. Activities can send one message an hour and three in 24 hours.</p>}
                  <div className="mt-3"><button type="button" className={btnPrimary} disabled={busy || waiting || cleaned === "" || !!problem} onClick={() => setStep("confirm")}>Review message</button></div>
                </>
              ) : (
                <div role="group" aria-labelledby="msg-confirm-h" className="rounded-xl border border-line-strong bg-cream p-4">
                  <h3 id="msg-confirm-h" className="font-display text-base font-bold text-ink">Send to {status.followers} {status.followers === 1 ? "follower" : "followers"}?</h3>
                  <p className="mt-2 whitespace-pre-line rounded-lg bg-white p-3 text-sm text-ink">{cleaned}</p>
                  <p className="mt-2 text-sm text-ink-soft">It goes to their notifications straight away and can&apos;t be unsent.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className={btnPrimary} disabled={busy} onClick={() => void send()}>{busy ? "Sending…" : `Send to ${status.followers} ${status.followers === 1 ? "follower" : "followers"}`}</button>
                    <button type="button" className={btnGhost} disabled={busy} onClick={() => setStep("write")}>Edit message</button>
                  </div>
                </div>
              )}
            </div>
          )}
          {msg && <p role={msg.tone === "err" ? "alert" : "status"} className={"mt-3 text-sm font-semibold " + (msg.tone === "err" ? "text-rose-700" : "text-emerald-700")}>{msg.text}</p>}

          <div className="mt-5 border-t border-line pt-4">
            <h3 className="font-display text-base font-bold text-ink">Previous messages</h3>
            {!history ? null : history.length === 0 ? (
              <p className="mt-1 text-sm text-ink-muted">No messages sent yet.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {history.map((m) => (
                  <li key={m.id} className="rounded-xl border border-line bg-white p-3">
                    <p className="text-xs font-semibold text-ink-muted">{when(m.created_at)}</p>
                    <p className="mt-0.5 whitespace-pre-line text-sm text-ink">{m.body}</p>
                    <p className="mt-1 text-xs text-ink-soft">{deliveryLine(m)}</p>
                    {m.hidden_at && <p className="mt-1 text-xs font-bold text-rose-800">Removed by OneShetland. Followers no longer see it in their notifications.</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
