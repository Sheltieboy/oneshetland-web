import { ActivityEditPage } from "@/components/activities/manage/ManagePages";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = await params;
  return <ActivityEditPage activityId={activityId} ctx={{ kind: "platform", ownerId: "", ownerName: "OneShetland", base: "/admin/activities", backHref: "/admin/activities", backLabel: "Regular activities" }} />;
}
