"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, StatusPill } from "@/components/admin/AdminUI";
import { useConfirm, useNotify } from "@/components/ui/ConfirmProvider";
import { INVITE_DEFAULT_DAYS, INVITE_MAX_DAYS, INVITE_TONE, clampInviteDays, inviteLabel } from "@/lib/launch-partners/invite-state";

export type InviteRow = {
  slug: string; business_id: string; business_name: string; created_at: string; expires_at: string | null;
  revoked_at: string | null; revoked_reason: string | null; status: string;
  claimant_name: string | null; claimant_email: string | null; claim_status: string | null;
};
export type PreviewOption = { slug: string; businessId: string; name: string };

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/**
 * Launch invitations — the admin front for admin_issue_launch_invite / admin_revoke_launch_invite.
 * The link is shown ONCE, when issued: the database keeps only a hash, so it cannot be shown again.
 * Issuing for a preview revokes its earlier invitation. Issuing sends nothing to anyone.
 */
export function LaunchInvites({ rows, previews }: { rows: InviteRow[]; previews: PreviewOption[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const notify = useNotify();
  const [slug, setSlug] = useState(previews[0]?.slug ?? "");
  const [days, setDays] = useState(INVITE_DEFAULT_DAYS);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<{ url: string; slug: string } | null>(null);

  async function issue() {
    const p = previews.find((x) => x.slug === slug);
    if (!p) return;
    const live = rows.find((r) => r.slug === slug && !r.revoked_at && r.status !== "expired");
    if (live && !(await confirm({ title: "Replace the current invitation?", body: <>{p.name} already has an invitation ({inviteLabel(live).toLowerCase()}). Issuing a new one revokes it at once; its link stops working.</>, confirmLabel: "Issue new invitation", danger: true }))) return;
    setBusy(true);
    try {
      const { data, error } = await createClient().rpc("admin_issue_launch_invite", { p_slug: p.slug, p_business_id: p.businessId, p_expires_at: new Date(Date.now() + days * 86_400_000).toISOString() });
      if (error) throw error;
      const t = (data as { token: string }).token;
      setLink({ url: `${window.location.origin}/launch/${p.slug}?invite=${t}`, slug: p.slug });
      router.refresh();
    } catch (e) { notify({ title: "Couldn't issue", body: e instanceof Error ? e.message : "Could not issue the invitation.", tone: "error" }); }
    finally { setBusy(false); }
  }

  async function revoke(r: InviteRow) {
    if (!(await confirm({ title: `Revoke the ${r.business_name} invitation?`, body: "Its link stops working immediately. A claim already sent is not affected.", confirmLabel: "Revoke", danger: true }))) return;
    const { error } = await createClient().rpc("admin_revoke_launch_invite", { p_slug: r.slug, p_reason: "revoked from the admin screen" });
    if (error) notify({ title: "Couldn't revoke", body: error.message, tone: "error" }); else router.refresh();
  }

  return (
    <div className="space-y-5">
      <Card>
        <p className="font-display font-bold text-ink">Issue an invitation</p>
        <p className="mt-1 text-sm text-ink-muted">One invitation belongs to one preview and one business. Nothing is sent: you copy the link yourself.</p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold text-ink-soft">Preview
            <select value={slug} onChange={(e) => setSlug(e.target.value)} className="mt-1 block rounded-lg border border-line-strong bg-white px-3 py-2 text-sm">
              {previews.map((p) => <option key={p.slug} value={p.slug}>{p.name} ({p.slug})</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-ink-soft">Valid for (days)
            <input type="number" min={1} max={INVITE_MAX_DAYS} value={days} onChange={(e) => setDays(clampInviteDays(e.target.value))} className="mt-1 block w-24 rounded-lg border border-line-strong bg-white px-3 py-2 text-sm" />
          </label>
          <button onClick={issue} disabled={busy || !slug} className="rounded-pill bg-rose-600 px-5 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-40">{busy ? "Issuing…" : "Issue invitation"}</button>
        </div>
        {link && (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3" role="status">
            <p className="text-sm font-bold text-amber-900">Copy this link now — it will not be shown again.</p>
            <input readOnly value={link.url} onFocus={(e) => e.currentTarget.select()} className="mt-2 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 font-mono text-xs" aria-label="Invitation link" />
            <button onClick={() => navigator.clipboard?.writeText(link.url)} className="mt-2 rounded-pill border border-amber-400 px-4 py-1.5 text-sm font-semibold text-amber-900 hover:bg-amber-100">Copy</button>
          </div>
        )}
      </Card>

      {rows.length === 0 ? <p className="text-sm text-ink-muted">No invitations yet.</p> : rows.map((r, i) => (
        <Card key={`${r.slug}-${r.created_at}-${i}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display font-bold text-ink">{r.business_name}</p>
                <StatusPill label={inviteLabel(r)} tone={INVITE_TONE[inviteLabel(r)]} />
              </div>
              <p className="mt-1 text-sm text-ink-muted">{r.slug} · issued {day(r.created_at)}{r.expires_at ? ` · expires ${day(r.expires_at)}` : ""}</p>
              {r.claimant_email && <p className="text-sm text-ink-soft">Claimed through it by {r.claimant_name ?? "—"} · {r.claimant_email} ({r.claim_status})</p>}
              {r.revoked_at && <p className="text-sm text-rose-700">{inviteLabel(r) === "Replaced" ? "Replaced by a newer invitation" : inviteLabel(r) === "Expired" ? "Closed after it expired" : "Revoked"} {day(r.revoked_at)}{r.revoked_reason && inviteLabel(r) === "Revoked" ? ` — ${r.revoked_reason}` : ""}</p>}
            </div>
            {!r.revoked_at && r.status !== "expired" && <button onClick={() => revoke(r)} className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50">Revoke</button>}
          </div>
        </Card>
      ))}
    </div>
  );
}
