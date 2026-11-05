import Link from "next/link";
import { getHomeEssential } from "@/lib/home-notices";
import { EssentialAlertSlot } from "@/components/notices/EssentialAlertSlot";
import type { Account } from "@/lib/auth";

/** Discreet, accessible notice for the "could not check" state. Deliberately NOT red: red is reserved for a real Essential Alert. */
export function EssentialUnavailable() {
  return (
    <div role="status" data-essential-unavailable className="border-b border-line bg-sand text-ink-soft">
      <p className="mx-auto max-w-6xl px-5 py-2 text-sm">
        We couldn&apos;t check for current alerts just now.{" "}
        <Link href="/notices?tab=essential" className="font-semibold text-navy underline underline-offset-2">See all alerts</Link>
      </p>
    </div>
  );
}

/** Async server component, rendered inside <Suspense> so a slow alert check never delays the rest of the page. */
export async function HomeEssentialAlerts({ account }: { account: Promise<Account | null> }) {
  const a = await account.catch(() => null);
  const e = await getHomeEssential(!!a);
  if (e.state === "unavailable") return <EssentialUnavailable />;
  if (e.state === "none") return null;
  return <EssentialAlertSlot alerts={e.alerts} scopedToMyAreas={e.scopedToMyAreas} />;
}
