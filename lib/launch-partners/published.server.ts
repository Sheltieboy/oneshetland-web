/**
 * The PUBLISHED launch profile for a business — what the owner approved and chose to put live — for the public business page.
 *
 * Read through launch_partner_published_profile, which answers anyone but returns ONLY the profile layer of the published
 * version, and only for a publicly visible business (an administrator, who can see hidden test fixtures, gets those too). It is
 * validated here with the same validator as any page draft: an address that is not https or our own path means the page is not
 * used at all, and the ordinary public page is shown instead. Nothing is written.
 */
import { createClient } from "@/lib/supabase/server";
import type { PageDraft } from "@/lib/business-page/types";
import { parsePageDraft } from "./validate";

export interface PublishedLaunchPage { versionId: string; publishedAt: string; draft: PageDraft }

export async function getPublishedLaunchPage(businessId: string): Promise<PublishedLaunchPage | null> {
  try {
    const sb = await createClient();
    const { data, error } = await sb.rpc("launch_partner_published_profile", { p_business_id: businessId });
    if (error || !data) return null;
    const r = data as { version_id: string; published_at: string; profile: Record<string, unknown> };
    const parsed = parsePageDraft({ version: 1, ...r.profile });
    return parsed.ok ? { versionId: r.version_id, publishedAt: r.published_at, draft: parsed.value } : null;
  } catch {
    return null;
  }
}
