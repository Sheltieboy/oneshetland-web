import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { NotificationInbox } from "@/components/notifications/NotificationInbox";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications · OneShetland" };

export default async function Page() {
  const account = await getAccount();
  if (!account) redirect("/sign-in?next=/notifications");

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-ink">Notifications</h1>
        <a href="/account/notifications" className="text-sm font-medium text-ink-soft underline-offset-2 hover:underline">
          Settings
        </a>
      </div>
      <p className="mt-1 text-ink-soft">Everything OneShetland has let you know about.</p>
      <NotificationInbox />
    </div>
  );
}
