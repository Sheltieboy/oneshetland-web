import { AdminHeader } from "@/components/admin/AdminUI";
import { AccessibilityAdmin } from "@/components/admin/AccessibilityAdmin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Accessible Shetland" };

export default function Page() {
  return (
    <>
      <AdminHeader title="Accessible Shetland" sub="Who has shared access information, suggestions from the public, and how much each listing can be trusted. Nothing here emails or notifies anyone." />
      <AccessibilityAdmin />
    </>
  );
}
