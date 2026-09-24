import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin-data.server";
import { getLaunchReadiness } from "@/lib/launch-readiness.server";
import { parseFilter } from "@/lib/launch-readiness";
import { AdminHeader } from "@/components/admin/AdminUI";
import { LaunchReadinessDashboard } from "@/components/admin/LaunchReadiness";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Launch readiness", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string; area?: string }> }) {
  // The layout checks too, but a page renders alongside its layout, so it guards itself.
  await requireAdmin();
  const data = await getLaunchReadiness();
  const { view, area } = await searchParams;
  return (
    <>
      <AdminHeader title="Launch readiness" sub="Where OneShetland stands on launch. Internal — admins only." />
      <LaunchReadinessDashboard data={data} view={parseFilter(view)} area={area ?? null} />
    </>
  );
}
