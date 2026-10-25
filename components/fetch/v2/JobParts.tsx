"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { messagesAction, paymentAction, photoBeginAction, photoSubmitAction, photoViewAction, reportProblemAction, sendMessageAction, setItemPhotoAction } from "@/app/fetch/actions";
import type { IssueKind, Message, Photo, PhotoKind } from "@/lib/fetch-api";
import { ISSUE_KINDS, when } from "@/lib/fetch/present";
import { newKey } from "@/lib/fetch/flow";
import { settleSavedCardPayment } from "@/lib/stripe-sca";
import { uploadOne } from "@/components/fetch/v2/upload";
import { FETCH_ACCENT, Notice, btnPrimary, btnQuiet, btnSecondary, field, label } from "@/components/fetch/v2/ui";

/** Messages between the requester and the driver: plain text only, through OneShetland; refreshed every 15s while visible. */
export function Messages({ requestId, initial, canSend, otherName }: { requestId: string; initial: Message[]; canSend: boolean; otherName: string }) {
  const [list, setList] = useState(initial);
  const [send, setSend] = useState(canSend);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef(newKey());

  useEffect(() => {
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      const r = await messagesAction(requestId).catch(() => null);
      if (r?.ok) { setList(r.data.messages); setSend(r.data.can_send); }
    };
    const t = setInterval(tick, 15_000);
    return () => clearInterval(t);
  }, [requestId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) { setError("Please write a message."); return; }
    setBusy(true); setError(null);
    // The same reference on a retry means the same message, never two.
    const r = await sendMessageAction(requestId, text.trim(), ref.current).catch(() => null);
    setBusy(false);
    if (!r) { setError("We couldn't send that. Please try again."); return; }
    if (!r.ok) { setError(r.message); return; }
    setText(""); ref.current = newKey();
    const m = await messagesAction(requestId).catch(() => null);
    if (m?.ok) setList(m.data.messages);
  }

  return (
    <div className="space-y-3">
      {list.length === 0 && <p className="text-sm text-ink-muted">No messages yet.</p>}
      <ul className="space-y-2" aria-live="polite">
        {list.map((m) => (
          <li key={m.id} className={`max-w-[85%] rounded-card px-3 py-2 text-sm ${m.from === "you" ? "ml-auto bg-orange-50" : "bg-sand/60"}`}>
            <p className="text-xs font-semibold text-ink-muted">{m.from === "you" ? "You" : otherName} · {when(m.created_at)}</p>
            {m.hidden ? <p className="italic text-ink-muted">Message removed</p> : <p className="whitespace-pre-wrap break-words text-ink">{m.body}</p>}
          </li>
        ))}
      </ul>
      {send ? (
        <form onSubmit={submit} className="space-y-2">
          <label className={label}>Message {otherName}
            <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} rows={2} className={field} />
          </label>
          <p className="text-xs text-ink-muted">Keep it to the Fetch. Messages are kept by OneShetland and can be read if a problem is reported.</p>
          {error && <Notice tone="error">{error}</Notice>}
          <button type="submit" disabled={busy} className={btnPrimary} style={{ background: FETCH_ACCENT }}>{busy ? "Sending…" : "Send"}</button>
        </form>
      ) : <p className="text-sm text-ink-muted">Messages for this Fetch have closed.</p>}
    </div>
  );
}

/** Report a problem (both parties, up to 72 hours after the Fetch finishes), with an optional photo. */
export function ReportProblem({ requestId, viewer }: { requestId: string; viewer: "requester" | "driver" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("");
  const [detail, setDetail] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const ref = useRef(newKey());
  const kinds = ISSUE_KINDS.filter((k) => k.who === "both" || k.who === viewer);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!kind) { setResult({ ok: false, msg: "Please choose what kind of problem it is." }); return; }
    setBusy(true); setResult(null);
    const r = await reportProblemAction(requestId, kind as IssueKind, detail.trim(), ref.current).catch(() => null);
    if (!r || !r.ok) { setBusy(false); setResult({ ok: false, msg: r?.message ?? "We couldn't send that. Please try again." }); return; }
    let msg = "Thank you — OneShetland has your report and will be in touch.";
    if (file) {
      const up = await uploadOne(file, (m, s) => photoBeginAction(requestId, "issue", m, s, { issueId: r.data.issue_id }) as never, (u) => photoSubmitAction(requestId, u));
      if (!up.ok) msg += ` Your photo wasn't added: ${up.message}`;
    }
    setBusy(false); setResult({ ok: true, msg }); ref.current = newKey(); router.refresh();
  }

  if (!open) return <button type="button" onClick={() => setOpen(true)} className={btnSecondary}>Report a problem</button>;
  return (
    <form onSubmit={submit} className="space-y-3 rounded-card border border-line p-3">
      <label className={label}>What&apos;s wrong?
        <select value={kind} onChange={(e) => setKind(e.target.value)} className={field}>
          <option value="">Choose…</option>{kinds.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
      </label>
      <label className={label}>Tell us what happened (optional)
        <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} maxLength={2000} className={field} />
      </label>
      <label className={label}>A photo (optional)
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 block text-sm" />
      </label>
      <p className="text-xs text-ink-muted">For anything urgent or unsafe, call 999 first. Problems can be reported up to 72 hours after a Fetch finishes.</p>
      {result && <Notice tone={result.ok ? "ok" : "error"}>{result.msg}</Notice>}
      {!result?.ok && <div className="flex gap-2">
        <button type="submit" disabled={busy} className={btnPrimary} style={{ background: FETCH_ACCENT }}>{busy ? "Sending…" : "Send report"}</button>
        <button type="button" onClick={() => setOpen(false)} className={btnSecondary}>Not now</button>
      </div>}
    </form>
  );
}

const PHOTO_LABEL: Record<PhotoKind, string> = { item: "Item", collection: "At collection", delivery: "At delivery", return: "Returned", issue: "With a report" };

/** Photos on a job: add one, open one through a short-lived private link, and (requester, before acceptance) show or hide an item photo on the board. */
export function PhotoSection({ requestId, photos, addKinds, manageItem }: { requestId: string; photos: Photo[]; addKinds: PhotoKind[]; manageItem: boolean }) {
  const router = useRouter();
  const [kind, setKind] = useState<PhotoKind | "">(addKinds.length === 1 ? addKinds[0] : "");
  const [onBoard, setOnBoard] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function add(file: File | undefined) {
    if (!file || !kind) return;
    setBusy(true); setMsg(null);
    const up = await uploadOne(file, (m, s) => photoBeginAction(requestId, kind, m, s, { showOnBoard: kind === "item" && onBoard }) as never, (u) => photoSubmitAction(requestId, u));
    setBusy(false);
    setMsg(up.ok ? { ok: true, text: "Photo added." } : { ok: false, text: up.message });
    if (up.ok) router.refresh();
  }
  async function open(id: string) {
    const r = await photoViewAction(id).catch(() => null);
    if (r?.ok) window.open(r.data.url, "_blank", "noopener,noreferrer"); else setMsg({ ok: false, text: r?.message ?? "We couldn't open that photo." });
  }
  async function change(id: string, action: "show_on_board" | "hide_from_board" | "withdraw") {
    const r = await setItemPhotoAction(requestId, id, action).catch(() => null);
    if (r?.ok) router.refresh(); else setMsg({ ok: false, text: r?.message ?? "That didn't work. Please try again." });
  }

  return (
    <div className="space-y-3">
      {photos.length === 0 ? <p className="text-sm text-ink-muted">No photos yet.</p> : (
        <ul className="divide-y divide-line text-sm">
          {photos.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="font-semibold text-ink">{PHOTO_LABEL[p.kind]}</span>
              <span className="text-xs text-ink-muted">{when(p.created_at)}{p.kind === "item" ? (p.matching_visible ? " · shown to drivers" : " · not shown to drivers") : ""}</span>
              <span className="ml-auto flex flex-wrap gap-1">
                <button type="button" onClick={() => open(p.id)} className={btnQuiet}>View</button>
                {manageItem && p.kind === "item" && p.mine && <>
                  <button type="button" onClick={() => change(p.id, p.matching_visible ? "hide_from_board" : "show_on_board")} className={btnQuiet}>{p.matching_visible ? "Hide from drivers" : "Show to drivers"}</button>
                  <button type="button" onClick={() => change(p.id, "withdraw")} className={btnQuiet}>Remove</button>
                </>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {addKinds.length > 0 && (
        <div className="space-y-2 rounded-card border border-dashed border-line p-3">
          {addKinds.length > 1 && (
            <label className={label}>What is this photo of?
              <select value={kind} onChange={(e) => setKind(e.target.value as PhotoKind)} className={field}>
                <option value="">Choose…</option>{addKinds.map((k) => <option key={k} value={k}>{PHOTO_LABEL[k]}</option>)}
              </select>
            </label>
          )}
          {kind === "item" && <label className="flex items-start gap-2 text-sm text-ink"><input type="checkbox" checked={onBoard} onChange={(e) => setOnBoard(e.target.checked)} className="mt-1" />Show this photo to drivers looking at the Fetch</label>}
          <label className={label}>{busy ? "Uploading…" : "Add a photo (JPEG, PNG or WEBP)"}
            <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || !kind} onChange={(e) => add(e.target.files?.[0])} className="mt-1 block text-sm" />
          </label>
          <p className="text-xs text-ink-muted">Photos are private to you, the other person on this Fetch and OneShetland. Links to them last two minutes.</p>
        </div>
      )}
      {msg && <Notice tone={msg.ok ? "ok" : "error"}>{msg.text}</Notice>}
    </div>
  );
}

/** Completing a payment the bank wants confirmed (3D Secure), with Stripe.js and the server's own client secret. */
export function PaymentConfirm({ requestId, paymentStatus }: { requestId: string; paymentStatus: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (paymentStatus === "requires_payment_method") {
    return <Notice tone="warn">Your card was declined. Please update your card in <a href="/account/payments" className="font-semibold underline">your payments</a>. If it isn&apos;t sorted in time, your Fetch goes back to other drivers — nothing is charged.</Notice>;
  }
  async function go() {
    setBusy(true); setMsg(null);
    const r = await paymentAction(requestId, "complete").catch(() => null);
    if (!r || !r.ok) { setBusy(false); setMsg({ ok: false, text: r?.message ?? "We couldn't reach OneShetland. Please try again." }); return; }
    if (r.data.payment === "authorised") { setBusy(false); setMsg({ ok: true, text: "Payment authorisation confirmed." }); router.refresh(); return; }
    if (!r.data.client_secret) { setBusy(false); setMsg({ ok: false, text: "Your bank's check isn't available just now. Please try again." }); return; }
    const out = await settleSavedCardPayment({ status: "requires_action", clientSecret: r.data.client_secret });
    await paymentAction(requestId, "refresh").catch(() => null);
    setBusy(false);
    setMsg(out.outcome === "succeeded" ? { ok: true, text: "Payment authorisation confirmed." }
      : out.outcome === "cancelled" ? { ok: false, text: "You closed your bank's check. Nothing has been taken — you can try again." }
      : out.outcome === "pending" ? { ok: true, text: "Your bank is still checking. We'll update this page." }
      : { ok: false, text: "Your bank didn't confirm it. Please try again, or update your card in your payments." });
    router.refresh();
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-ink">Your bank needs you to confirm this payment authorisation.</p>
      <p className="text-xs text-ink-muted">Nothing is charged until delivery — this only reserves the amount.</p>
      <button type="button" onClick={go} disabled={busy} className={btnPrimary} style={{ background: FETCH_ACCENT }}>{busy ? "Opening your bank's check…" : "Confirm with my bank"}</button>
      {msg && <Notice tone={msg.ok ? "ok" : "error"}>{msg.text}</Notice>}
    </div>
  );
}
