import { requireBusinessOwner } from "@/lib/business-server";
import { ActivityEditPage } from "@/components/activities/manage/ManagePages";

export const dynamic = "force-dynamic";
export const metadata = { title: "Manage activity" };

export default async function Page({ params }: { params: Promise<{ id: string; activityId: string }> }) {
  const { id, activityId } = await params;
  const { business } = await requireBusinessOwner(id, { returnPath: `/business/${id}/manage/activities/${activityId}` });
  return <ActivityEditPage activityId={activityId} ctx={{ kind: "business", ownerId: business.id, ownerName: business.name, base: `/business/${business.id}/manage/activities`, backHref: `/business/${business.id}/manage/activities`, backLabel: "Regular activities" }} />;
}
