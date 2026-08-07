"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * NoticeBroadcast — admin-only control to push an urgent notice island-wide.
 *
 * Web twin of the button on the app's Notices screen. All the rules (admins
 * only, urgent + public + unexpired, once only) live in the
 * notify-community-notice edge function; this asks, then calls.
 *
 * The confirm step is not ceremony: the push bypasses quiet hours and cannot
 * be recalled.
 */
export function NoticeBroadcast({
  noticeId,
  title,
  broadcastAt,
}: {
  noticeId: string;
  title: string;
  broadcastAt: string | null;
}) {
  const [sentAt, setSentAt] = useState<string | null>(broadcastAt);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (sentAt) {
    return <p className="mt-3 text-xs font-semibold text-emerald-600">✓ Sent island-wide</p>;
  }

  async function send() {
    setBusy(true); setError(null);
    try {
      const sb = createClient();
      const { data, error: err } = await sb.functions.invoke("notify-community-notice", {
        body: { notice_id: noticeId },
      });
      if (err) {
        let message = "Could not send that notice.";
        try {
          const body = await (err as { context?: Response }).context?.json();
          if (body?.error) message = body.error as string;
        } catch { /* keep the generic message */ }
        throw new Error(message);
      }
      setSentAt(new Date().toISOString());
      setAsking(false);
      console.info("[notice-broadcast]", data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      {!asking ? (
        <button
          onClick={() => setAsking(true)}
          className="rounded-pill bg-rose-600 px-4 py-2 text-xs font-bold text-white transition hover:brightness-95"
        >
          📣 Send to everyone
        </button>
      ) : (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
          <p className="text-xs text-rose-900">
            <span className="font-bold">&ldquo;{title}&rdquo;</span> will be pushed to every OneShetland user who
            hasn&apos;t turned notices off — including through quiet hours. It can only be sent once and cannot be
            recalled.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setAsking(false)}
              disabled={busy}
              className="rounded-pill border border-line-strong bg-paper px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={send}
              disabled={busy}
              className="rounded-pill bg-rose-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send island-wide"}
            </button>
          </div>
          {error && <p className="mt-2 text-xs font-semibold text-rose-700">{error}</p>}
        </div>
      )}
    </div>
  );
}
