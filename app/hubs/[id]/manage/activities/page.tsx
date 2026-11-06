import { requireHubAdmin } from "@/lib/hubs-server";
import { ActivitiesListPage } from "@/components/activities/manage/ManagePages";

export const dynamic = "force-dynamic";
export const metadata = { title: "Regular activities" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { hub } = await requireHubAdmin(id);
  const base = `/hubs/${hub.slug || hub.id}/manage/activities`;
  return <ActivitiesListPage ctx={{ kind: "hub", ownerId: hub.id, ownerName: hub.name, base, backHref: `/hubs/${hub.slug || hub.id}/manage`, backLabel: "Back to management", hubVerified: !!hub.is_verified }} />;
}
