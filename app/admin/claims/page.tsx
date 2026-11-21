import Link from "next/link";
import { getBusinessClaims } from "@/lib/admin-data.server";
import { AdminHeader } from "@/components/admin/AdminUI";
import { ClaimsManager } from "@/components/admin/ClaimsManager";
import { LaunchPartnerAccess, type GrantListRow } from "@/components/admin/LaunchPartnerAccess";
import { createClient } from "@/lib/supabase/server";
import type { LaunchLookupRow } from "@/lib/launch-grant";
import { LaunchInvites, type InviteRow } from "@/components/admin/LaunchInvites";
import { launchPreviewOptions } from "@/lib/launch-preview/registry";
import { AddOnBehalf } from "@/components/admin/assisted/AddOnBehalf";
import { AssistedRecords } from "@/components/admin/assisted/AssistedRecords";
import { listAssisted } from "@/lib/assisted/client";
import { listInvites, waitingClaims } from "@/lib/assisted/invites.server";
import { ClaimsWaiting } from "@/components/admin/assisted/ClaimsWaiting";
import {
  createAssistedBusinessAction, forgetAssistedContactAction, editAssistedAction,
  issueAssistedInviteAction, markAssistedInviteSentAction, revokeAssistedInviteAction,
  assistedInviteAuditAction, decideAssistedClaimAction, assistedSupportStateAction,
  sendAssistedInviteEmailAction, liftAssistedContactPreferenceAction,
  recordAssistedSupportAction, endAssistedSupportAction, assistedSupportLogAction,
} from "@/app/admin/assisted/actions";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string; business?: string; tier?: string }> }) {
  const { status, business, tier } = await searchParams;
  const invites = status === "invites";
  const launch = status === "launch";
  const assisted = status === "assisted";
  const filter = (status === "approved" || status === "all" ? status : "pending") as "pending" | "approved" | "all";
  const rows = launch || invites || assisted ? [] : await getBusinessClaims(filter);
  const assistedRows = assisted ? await listAssisted("business") : [];
  const assistedInvites = assisted ? await listInvites("business") : [];
  // Keep the result whole: an unreadable queue must not render as an empty one.
  const assistedClaimsResult = assisted ? await waitingClaims() : ({ ok: true as const, claims: [] });
  const assistedClaims = assistedClaimsResult.ok
    ? { ok: true as const, claims: assistedClaimsResult.claims.filter((c) => c.claim_kind === "business") }
    : assistedClaimsResult;
  // Admin-only RPC (it refuses everyone else); the page already sits behind requireAdmin.
  const grants = launch ? (((await (await createClient()).rpc("admin_list_launch_plans")).data ?? []) as GrantListRow[]) : [];
  const picked = launch && business ? (((await (await createClient()).rpc("admin_launch_business_lookup", { p_query: business })).data ?? []) as LaunchLookupRow[])[0] ?? null : null;
  const inviteRows = invites ? (((await (await createClient()).rpc("admin_list_launch_invites")).data ?? []) as InviteRow[]) : [];
  const tabs: [string, string][] = [["pending", "Pending"], ["approved", "Approved"], ["all", "All"], ["assisted", "Added on behalf of…"], ["launch", "Launch partner access"], ["invites", "Launch invitations"]];
  return (
    <>
      <AdminHeader title="Business claims" sub="Verify who owns each directory listing." />
      <div className="mb-5 flex gap-2">
        {tabs.map(([k, label]) => (
          <Link key={k} href={`/admin/claims?status=${k}`} className={"rounded-pill px-4 py-1.5 text-sm font-semibold " + ((launch ? "launch" : invites ? "invites" : assisted ? "assisted" : filter) === k ? "bg-rose-600 text-white" : "border border-line-strong text-ink-soft hover:bg-sand")}>{label}</Link>
        ))}
      </div>
      {assisted ? (
        <div className="space-y-5">
          <AddOnBehalf kind="business" submit={createAssistedBusinessAction} />
          {(!assistedClaimsResult.ok || assistedClaims.ok && assistedClaims.claims.length > 0) && (
            <div className="space-y-3">
              <h3 className="font-display text-lg font-bold text-ink">Waiting for your decision</h3>
              <ClaimsWaiting result={assistedClaims} decide={decideAssistedClaimAction} />
            </div>
          )}
          <AssistedRecords
            rows={assistedRows} kind="business"
            forget={forgetAssistedContactAction} edit={editAssistedAction}
            invites={assistedInvites}
            issue={issueAssistedInviteAction}
            markSent={markAssistedInviteSentAction}
            revoke={revokeAssistedInviteAction}
            audit={assistedInviteAuditAction}
            sendEmail={sendAssistedInviteEmailAction}
            liftContactPreference={liftAssistedContactPreferenceAction}
            supportState={assistedSupportStateAction}
            recordSupport={recordAssistedSupportAction}
            endSupport={endAssistedSupportAction}
            supportLog={assistedSupportLogAction}
          />
        </div>
      ) : invites ? <LaunchInvites rows={inviteRows} previews={launchPreviewOptions()} /> : launch ? <LaunchPartnerAccess grants={grants} initial={picked} initialTier={tier === "premium" ? "premium" : undefined} /> : <ClaimsManager key={filter} rows={rows as never[]} />}
    </>
  );
}
