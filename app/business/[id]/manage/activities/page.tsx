import { requireBusinessOwner } from "@/lib/business-server";
import { ActivitiesListPage } from "@/components/activities/manage/ManagePages";

export const dynamic = "force-dynamic";
export const metadata = { title: "Regular activities" };

// Deliberately NOT behind the commercial-terms gate: listing a class or group is free and involves no payment.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusinessOwner(id, { returnPath: `/business/${id}/manage/activities` });
  return <ActivitiesListPage ctx={{ kind: "business", ownerId: business.id, ownerName: business.name, base: `/business/${business.id}/manage/activities`, backHref: `/business/${business.id}/manage`, backLabel: business.name }} />;
}
