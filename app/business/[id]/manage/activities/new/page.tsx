import { requireBusinessOwner } from "@/lib/business-server";
import { ActivityNewPage } from "@/components/activities/manage/ManagePages";

export const dynamic = "force-dynamic";
export const metadata = { title: "New activity" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusinessOwner(id, { returnPath: `/business/${id}/manage/activities/new` });
  return <ActivityNewPage ctx={{ kind: "business", ownerId: business.id, ownerName: business.name, base: `/business/${business.id}/manage/activities`, backHref: `/business/${business.id}/manage/activities`, backLabel: "Regular activities" }} />;
}
