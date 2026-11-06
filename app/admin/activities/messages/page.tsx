import { AdminHeader } from "@/components/admin/AdminUI";
import { ActivityMessagesAdmin } from "@/components/admin/ActivityMessagesAdmin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Messages to followers" };

export default function Page() {
  return (
    <>
      <AdminHeader title="Messages to followers" sub="What organisers have sent to the people following their regular activities. Hide anything inappropriate: it leaves followers' notifications, and the record is kept." />
      <ActivityMessagesAdmin />
    </>
  );
}
