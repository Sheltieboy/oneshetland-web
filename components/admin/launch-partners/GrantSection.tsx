import Link from "next/link";
import { Section } from "./fields";
import { LaunchPartnerAccess } from "@/components/admin/LaunchPartnerAccess";
import type { LaunchLookupRow } from "@/lib/launch-grant";

/**
 * Launch partner access, for THIS campaign's business, on the campaign page. It is the existing Launch partner access panel, locked
 * to one business and with the search removed — not a second implementation: the form, the confirmation, the database functions
 * (admin_grant_launch_plan / admin_revoke_launch_plan) and their audit record are the generic screen's own. After a grant the panel
 * refreshes the page, and the workflow ticks "Grant Launch Partner" from the real grant record.
 */
export function GrantSection({ businessId, businessName, lookup }: { businessId: string; businessName: string; lookup: LaunchLookupRow | null }) {
  return (
    <Section id="grant" title="Launch partner access" sub={`Give ${businessName} Pro or Premium free until a date you choose. Their claim is approved; nothing here changes it. The business is fixed to this campaign.`}>
      {lookup
        ? <LaunchPartnerAccess key={`${lookup.grant_id ?? "none"}:${lookup.grant_tier ?? ""}:${lookup.grant_expires_at ?? ""}:${lookup.tier}`} grants={[]} initial={lookup} initialTier="premium" lockedTo={businessId} />
        : <p role="alert" className="text-sm font-semibold text-rose-700">The business could not be read just now. Refresh the page, or use the full screen below.</p>}
      <p className="text-sm"><Link href={`/admin/claims?status=launch&business=${businessId}`} className="font-semibold text-ink-soft underline underline-offset-2">Open the full Launch partner access screen →</Link></p>
    </Section>
  );
}
