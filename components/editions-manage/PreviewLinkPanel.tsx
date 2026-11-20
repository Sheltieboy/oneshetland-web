"use client";

import { useState } from "react";
import { createEditionPreviewLink, revokeEditionPreviewLink } from "@/app/organise/actions";
import { can } from "@/lib/editions/rules";
import type { OrgRole } from "@/lib/editions/types";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { Notice, btnPrimary, btnSecondary } from "./kit";
import { useAction } from "./use-action";

export type PreviewLinkState = { has_link: boolean; expires_at: string | null; created_at: string | null; expired: boolean } | null;

const day = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }).format(new Date(iso)) : "";

/**
 * Share an unpublished Edition with the person it is about — the organiser, a participating business,
 * a partner — without putting them on the team.
 *
 * The token is shown ONCE, when it is made. Nothing stores it where this screen could read it back,
 * so there is no "show the link again": if it is lost, make a new one, which replaces the old.
 */
export function PreviewLinkPanel({ organiserSlug, editionSlug, role, state }: {
  organiserSlug: string; editionSlug: string; role: OrgRole; state: PreviewLinkState;
}) {
  const { pending, msg, run } = useAction();
  const confirm = useConfirm();
  const [made, setMade] = useState<{ url: string; expiresAt?: string } | null>(null);
  const [days, setDays] = useState(14);
  const [copied, setCopied] = useState(false);
  const mayShare = can(role, "admin");
  const live = state?.has_link === true && !state.expired;

  const copy = async (url: string) => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* the field is selectable either way */ }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">
        A private, read-only link to this Edition, for somebody who should see it before it is published.
        They need no OneShetland account, they cannot change anything, and the link opens this Edition
        and nothing else.
      </p>

      {made ? (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-900">Your link is ready. Copy it now — it is not shown again.</p>
          <label className="sr-only" htmlFor="ed-preview-url">Preview link</label>
          <input
            id="ed-preview-url" readOnly value={made.url}
            onFocus={(e) => e.currentTarget.select()}
            className="mt-3 w-full rounded border border-line bg-white px-3 py-2 font-mono text-xs text-ink"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => copy(made.url)} className={btnPrimary}>{copied ? "Copied" : "Copy link"}</button>
            {made.expiresAt && <span className="text-sm text-emerald-900">Works until {day(made.expiresAt)}</span>}
          </div>
        </div>
      ) : live ? (
        <p role="status" className="text-sm font-semibold text-ink">
          A preview link is active{state?.expires_at ? ` until ${day(state.expires_at)}` : ""}.
          <span className="block font-normal text-ink-soft">The link itself is not kept, so it cannot be shown again. Make a new one to replace it, or revoke it below.</span>
        </p>
      ) : state?.expired ? (
        <p role="status" className="text-sm font-semibold text-ink">The last preview link expired{state.expires_at ? ` on ${day(state.expires_at)}` : ""}. Make a new one when you need it.</p>
      ) : null}

      {mayShare ? (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="ed-preview-days" className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">Lasts for</label>
            <select
              id="ed-preview-days" value={days} onChange={(e) => setDays(Number(e.target.value))}
              className="mt-1 rounded border border-line bg-white px-3 py-2 text-sm"
            >
              {[7, 14, 30, 60, 90].map((d) => <option key={d} value={d}>{d} days</option>)}
            </select>
          </div>
          <button
            type="button" disabled={pending} className={btnPrimary}
            onClick={() => run(() => createEditionPreviewLink(organiserSlug, editionSlug, days), {
              onOk: (r) => setMade({ url: r.url!, expiresAt: r.expiresAt }),
            })}
          >
            {live ? "Replace the link" : "Create a preview link"}
          </button>
          {(live || state?.has_link) && (
            <button
              type="button" disabled={pending} className={btnSecondary}
              onClick={async () => {
                if (!(await confirm({
                  title: "Revoke this preview link?",
                  body: "Anyone holding it will stop being able to open this Edition straight away. Nothing about the Edition itself changes.",
                  confirmLabel: "Revoke the link",
                }))) return;
                run(() => revokeEditionPreviewLink(organiserSlug, editionSlug), { success: "The preview link has been revoked.", onOk: () => setMade(null) });
              }}
            >
              Revoke
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm text-ink-muted">Only an owner or administrator can share a preview.</p>
      )}

      <Notice msg={msg} />
    </div>
  );
}
