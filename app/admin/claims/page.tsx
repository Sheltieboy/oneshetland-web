import Link from "next/link";
import { getBusinessClaims } from "@/lib/admin-data.server";
import { AdminHeader } from "@/components/admin/AdminUI";
import { ClaimsManager } from "@/components/admin/ClaimsManager";
import { LaunchPartnerAccess, type GrantListRow } from "@/components/admin/LaunchPartnerAccess";
import { createClient } from "@/lib/supabase/server";
import type { LaunchLookupRow } from "@/lib/launch-grant";
import { LaunchInvites, type InviteRow } from "@/components/admin/LaunchInvites";
import { launchPreviewOptions } from "@/lib/launch-preview/registry";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string; business?: string; tier?: string }> }) {
  const { status, business, tier } = await searchParams;
  const invites = status === "invites";
  const launch = status === "launch";
  const filter = (status === "approved" || status === "all" ? status : "pending") as "pending" | "approved" | "all";
  const rows = launch || invites ? [] : await getBusinessClaims(filter);
  // Admin-only RPC (it refuses everyone else); the page already sits behind requireAdmin.
  const grants = launch ? (((await (await createClient()).rpc("admin_list_launch_plans")).data ?? []) as GrantListRow[]) : [];
  const picked = launch && business ? (((await (await createClient()).rpc("admin_launch_business_lookup", { p_query: business })).data ?? []) as LaunchLookupRow[])[0] ?? null : null;
  const inviteRows = invites ? (((await (await createClient()).rpc("admin_list_launch_invites")).data ?? []) as InviteRow[]) : [];
  const tabs: [string, string][] = [["pending", "Pending"], ["approved", "Approved"], ["all", "All"], ["launch", "Launch partner access"], ["invites", "Launch invitations"]];
  return (
    <>
      <AdminHeader title="Business claims" sub="Verify who owns each directory listing." />
      <div className="mb-5 flex gap-2">
        {tabs.map(([k, label]) => (
          <Link key={k} href={`/admin/claims?status=${k}`} className={"rounded-pill px-4 py-1.5 text-sm font-semibold " + ((launch ? "launch" : invites ? "invites" : filter) === k ? "bg-rose-600 text-white" : "border border-line-strong text-ink-soft hover:bg-sand")}>{label}</Link>
        ))}
      </div>
      {invites ? <LaunchInvites rows={inviteRows} previews={launchPreviewOptions()} /> : launch ? <LaunchPartnerAccess grants={grants} initial={picked} initialTier={tier === "premium" ? "premium" : undefined} /> : <ClaimsManager key={filter} rows={rows as never[]} />}
    </>
  );
}
