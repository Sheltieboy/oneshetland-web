import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { getNotificationPrefs } from "@/lib/account-data.server";
import { NotificationPrefsForm } from "@/components/account/NotificationPrefsForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications" };

export default async function Page() {
  const account = await getAccount();
  if (!account) redirect("/sign-in?next=/account/notifications");
  const prefs = await getNotificationPrefs(account.id);
  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl font-bold text-ink">Notifications</h1>
      <p className="mt-1 text-ink-soft">Choose what OneShetland tells you about. Changes save automatically.</p>
      <div className="mt-6">
        <NotificationPrefsForm userId={account.id} initial={prefs} />
      </div>
    </div>
  );
}
