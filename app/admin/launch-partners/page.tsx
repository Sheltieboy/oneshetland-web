import { AdminHeader } from "@/components/admin/AdminUI";
import { LaunchPartnersPipeline } from "@/components/admin/launch-partners/Pipeline";
import { listCampaigns } from "@/lib/launch-partners/campaigns.server";
import { launchPreviewOptions } from "@/lib/launch-preview/registry";
import type { PipelineRow } from "@/lib/launch-partners/status";

export const dynamic = "force-dynamic";
export const metadata = { title: "Launch partners" };

export default async function Page() {
  let rows: PipelineRow[] = [];
  let loadError: string | null = null;
  try { rows = await listCampaigns(); } catch (e) { loadError = e instanceof Error ? e.message : "Could not load launch partners."; }
  const have = new Set(rows.map((r) => r.business_id));
  // Researched previews that exist in code but are not yet campaigns (the test fixture is never offered).
  const importable = launchPreviewOptions().filter((o) => o.slug !== "zz-test-acceptance" && !have.has(o.businessId)).map((o) => o.name);
  return (
    <>
      <AdminHeader title="Launch partners" sub="Prepare a private preview and a better business page, invite the business, and follow it through to going live." />
      <LaunchPartnersPipeline rows={rows} importable={importable} loadError={loadError} />
    </>
  );
}
