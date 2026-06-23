import { getRegions } from "@/lib/admin-data.server";
import { AdminHeader } from "@/components/admin/AdminUI";
import { RegionsManager } from "@/components/admin/RegionsManager";

export const dynamic = "force-dynamic";

export default async function Page() {
  const rows = await getRegions();
  return (
    <>
      <AdminHeader title="Regions" sub="The Shetland areas customers can choose across the platform." />
      <RegionsManager rows={rows as never[]} />
    </>
  );
}
