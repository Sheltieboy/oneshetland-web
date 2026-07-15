"use client";

/**
 * ContentActions — the per-item report/block affordance for user-generated
 * content on the website (app-store-required UGC safety: Apple Guideline 1.2 /
 * Google Play UGC policy).
 *
 * Web mirror of the mobile app's <ContentActions>:
 *   • Report      — always offered to signed-in users; opens a reason picker.
 *   • Block user   — offered when an author id is known and it isn't the
 *                    viewer's own content.
 *
 * Files into content_reports / blocked_users via lib/moderation.ts, matching
 * the app's table shapes so the /admin/reports queue categorises it unchanged.
 *
 *   <ContentActions
 *     contentType="vessel_comment"
 *     contentId={comment.id}
 *     authorId={comment.author_id}
 *     authorName={who(comment.author)}
 *     viewerId={userId}
 *     onBlocked={() => router.refresh()}
 *   />
 */

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useConfirm, useNotify } from "@/components/ui/ConfirmProvider";
import {
  reportContent, blockUser, REPORT_REASONS, type ReportContentType,
} from "@/lib/moderation";

const ACCENT = "#1d5f7a";

export function ContentActions({
  contentType, contentId, authorId, authorName, viewerId, onBlocked, accent = ACCENT,
}: {
  contentType: ReportContentType;
  contentId: string;
  /** The content author's user id — enables "Block this user". */
  authorId?: string | null;
  /** Author's display name, used in the block confirmation copy. */
  authorName?: string | null;
  /** The signed-in viewer's id, so we never offer block-yourself. */
  viewerId: string | null;
  /** Called after the author has been blocked, so the host can refresh. */
  onBlocked?: (authorId: string) => void;
  accent?: string;
}) {
  const confirm = useConfirm();
  const notify = useNotify();
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canBlock = !!authorId && authorId !== viewerId;
  const who = authorName?.trim() || "this person";

  function openReport() {
    setReason(null); setDetails(""); setBusy(false); setDone(false); setError(null);
    setReporting(true);
  }

  async function submit() {
    if (!reason || busy) return;
    setBusy(true); setError(null);
    try {
      await reportContent({ contentType, contentId, reportedUserId: authorId ?? null, reason, details: details.trim() || null });
      setDone(true);
      setTimeout(() => setReporting(false), 1600);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send your report. Please try again.");
      setBusy(false);
    }
  }

  async function confirmBlock() {
    if (!authorId) return;
    if (!(await confirm({ title: `Block ${who}?`, body: `You won't see ${who}'s comments or posts anywhere in OneShetland.`, confirmLabel: "Block", danger: true }))) return;
    try {
      await blockUser(authorId);
      onBlocked?.(authorId);
    } catch (e) {
      notify({ title: "Couldn't block", body: e instanceof Error ? e.message : "Could not block this user.", tone: "error" });
    }
  }

  return (
    <>
      <button onClick={openReport} className="hover:text-rose-600">Report</button>
      {canBlock && <button onClick={confirmBlock} className="hover:text-rose-600">Block</button>}

      <Modal open={reporting} onClose={() => setReporting(false)} title={done ? "Thanks" : "Report this"} accent={accent}>
        {done ? (
          <div className="py-4 text-center">
            <p className="font-display text-lg font-bold text-ink">Thanks — we&apos;ll review this within 24 hours</p>
            <p className="mt-2 text-sm text-ink-soft">Our team looks at every report. You won&apos;t hear back individually, but we take action where it&apos;s needed.</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-ink-soft">What&apos;s wrong with this? Pick the closest reason — you can add more below.</p>
            <div className="mt-3 space-y-1.5">
              {REPORT_REASONS.map((r) => {
                const active = reason === r.key;
                return (
                  <button
                    key={r.key}
                    onClick={() => setReason(r.key)}
                    className={"flex w-full items-center gap-3 rounded-card border px-4 py-3 text-left text-sm font-semibold " + (active ? "border-line-strong bg-sand text-ink" : "border-line bg-paper text-ink-soft hover:bg-sand/50")}
                  >
                    <span className={"grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 " + (active ? "border-ink" : "border-line-strong")}>
                      {active && <span className="h-2.5 w-2.5 rounded-full bg-ink" />}
                    </span>
                    {r.label}
                  </button>
                );
              })}
            </div>
            <label className="mt-4 block text-sm font-bold text-ink-soft">Anything else? (optional)</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              placeholder="Add any detail that helps us understand…"
              className="auth-input mt-1.5 resize-none"
            />
            {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button
                onClick={submit}
                disabled={!reason || busy}
                className="rounded-pill px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
                style={{ background: accent }}
              >
                {busy ? "Sending…" : "Submit report"}
              </button>
              <button onClick={() => setReporting(false)} disabled={busy} className="rounded-pill border border-line-strong px-5 py-2 text-sm font-semibold text-ink-soft hover:bg-sand">Cancel</button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
