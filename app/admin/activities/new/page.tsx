import { ActivityNewPage } from "@/components/activities/manage/ManagePages";

export const dynamic = "force-dynamic";

export default function Page() {
  return <ActivityNewPage ctx={{ kind: "platform", ownerId: "", ownerName: "OneShetland", base: "/admin/activities", backHref: "/admin/activities", backLabel: "Regular activities" }} />;
}
