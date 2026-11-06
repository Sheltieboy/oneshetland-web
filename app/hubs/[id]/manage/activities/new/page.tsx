import { requireHubAdmin } from "@/lib/hubs-server";
import { ActivityNewPage } from "@/components/activities/manage/ManagePages";

export const dynamic = "force-dynamic";
export const metadata = { title: "New activity" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { hub } = await requireHubAdmin(id);
  const base = `/hubs/${hub.slug || hub.id}/manage/activities`;
  return <ActivityNewPage ctx={{ kind: "hub", ownerId: hub.id, ownerName: hub.name, base, backHref: base, backLabel: "Regular activities", hubVerified: !!hub.is_verified }} />;
}
