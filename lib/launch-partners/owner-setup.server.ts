/**
 * Reads for the owner's launch setup — all with the SIGNED-IN OWNER's own session, through the database functions that only
 * ever answer an approved launch-partner owner (they return nothing, never an error, to anyone else). Nothing here writes.
 */
import { createClient } from "@/lib/supabase/server";
import type { PageDraft } from "@/lib/business-page/types";
import { parsePageDraft } from "./validate";
import { deriveOwnerLaunch, overlayProfile, type OwnerLaunch, type OwnerLaunchInput, type OwnerProfile } from "./owner-setup";

export interface OwnerLaunchSetup {
  launch: OwnerLaunch;
  campaignId: string | null;
  /** The prepared page as the owner should see it: the admin's draft with the owner's own latest saved profile laid over it. */
  draft: PageDraft | null;
  /** The admin's prepared draft, before any owner edit (what "start again" would mean). */
  prepared: PageDraft | null;
  versions: OwnerLaunchInput["versions"];
  latestProfile: OwnerProfile | null;
}

export async function getOwnerLaunchSetup(businessId: string): Promise<OwnerLaunchSetup> {
  const none = (): OwnerLaunchSetup => ({ launch: deriveOwnerLaunch({ hasCampaign: false, grants: [], versions: [] }), campaignId: null, draft: null, prepared: null, versions: [], latestProfile: null });
  try {
    const sb = await createClient();
    const { data: d } = await sb.rpc("launch_partner_page_draft", { p_business_id: businessId });
    const row = d as { campaign_id: string; page_config: unknown } | null;
    if (!row) return none();                       // not this campaign's approved owner (or no campaign): indistinguishable, on purpose
    const parsed = parsePageDraft(row.page_config);
    const [{ data: v }, { data: g }, { data: h, error: hErr }] = await Promise.all([
      sb.rpc("launch_partner_profile_versions", { p_business_id: businessId }),
      sb.from("launch_plan_grants").select("expires_at, revoked_at, superseded_at").eq("business_id", businessId),
      sb.rpc("launch_partner_publication_hold", { p_business_id: businessId }),
    ]);
    const versions = ((v ?? []) as OwnerLaunchInput["versions"]);
    // The takedown hold (no reason is ever returned). If it cannot be read, say nothing: the screen then stays on the safe side.
    const held = hErr || !h ? null : (h as { held?: boolean }).held === true;
    const launch = deriveOwnerLaunch({ hasCampaign: true, grants: (g ?? []) as OwnerLaunchInput["grants"], versions, held });
    // The newest owner-authored snapshot (an edit, or the approved copy of one) is what the owner sees; the admin's draft is the base.
    const newest = versions.find((x) => x.kind === "owner_edit" || x.kind === "approved");
    let latestProfile: OwnerProfile | null = null;
    if (newest) { const { data: p } = await sb.rpc("launch_partner_version_profile", { p_business_id: businessId, p_version_id: newest.id }); latestProfile = (p as OwnerProfile | null) ?? null; }
    const prepared = parsed.ok ? parsed.value : null;
    return { launch, campaignId: row.campaign_id, draft: prepared ? overlayProfile(prepared, latestProfile) : null, prepared, versions, latestProfile };
  } catch {
    return none();
  }
}
