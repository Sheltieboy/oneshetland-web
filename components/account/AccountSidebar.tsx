"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSaved } from "@/components/saved/context";
import { SAVED_MENU_LABEL } from "@/lib/saved-copy";
import { ADD_EVENT_HREF, ADD_EVENT_SIDEBAR_LABEL, MY_EVENTS_HREF, MY_EVENTS_LABEL } from "@/lib/event-entry-points";

type Item = { href: string; label: string; external?: boolean };

export function AccountSidebar({ isAdmin, isBusiness, addEvent = false, myEvents = false }: { isAdmin: boolean; isBusiness: boolean; addEvent?: boolean; myEvents?: boolean }) {
  const path = usePathname();
  const savedOn = useSaved().enabled;
  const account: Item[] = [
    { href: "/account", label: "Overview" },
    { href: "/account/profile", label: "Edit profile" },
    { href: "/account/notifications", label: "Notifications" },
    { href: "/account/security", label: "Security" },
  ];
  const activity: Item[] = [
    { href: "/account/wallet", label: "Wallet" },
    { href: "/account/bookings", label: "My bookings" },
    { href: "/account/passes", label: "My passes" },
    { href: "/account/gifts", label: "My gifts" },
    { href: "/account/loyalty", label: "Loyalty cards" },
    { href: "/account/memberships", label: "Memberships" },
    { href: "/account/following", label: "Following" },
    { href: "/account/hubs", label: "Hubs I manage" },
    { href: "/jobs/applications", label: "Job applications", external: true },
    { href: "/games/stats", label: "Game stats", external: true },
  ];
  // Only passed (true) by the server when EVENT_FRONT_DOOR === "on".
  if (addEvent) activity.splice(activity.findIndex((i) => i.href === "/account/hubs") + 1, 0, { href: ADD_EVENT_HREF, label: ADD_EVENT_SIDEBAR_LABEL });
  // Only passed (true) by the server for a person who can open the page (flag on, admin, or allowlisted tester): the link can never lead to a 404.
  if (myEvents) activity.splice(activity.findIndex((i) => i.href === (addEvent ? ADD_EVENT_HREF : "/account/hubs")) + 1, 0, { href: MY_EVENTS_HREF, label: MY_EVENTS_LABEL });
  // Only when My Saved is switched on.
  if (savedOn) activity.splice(activity.findIndex((i) => i.href === "/account/following"), 0, { href: "/account/saved", label: SAVED_MENU_LABEL });
  if (isBusiness) activity.splice(2, 0, { href: "/directory/new", label: "Add a business", external: true });

  const Section = ({ title, items }: { title: string; items: Item[] }) => (
    <div>
      <p className="mb-2 px-3 text-xs font-bold uppercase tracking-widest text-ink-faint">{title}</p>
      <div className="space-y-0.5">
        {items.map((it) => {
          const active = !it.external && (path === it.href || (it.href !== "/account" && path.startsWith(it.href)));
          return (
            <Link key={it.href} href={it.href}
              className={"flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold transition " + (active ? "bg-navy text-white" : "text-ink-soft hover:bg-sand")}>
              {it.label}{it.external && <span className="text-ink-faint">↗</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );

  return (
    <nav className="space-y-6">
      <Section title="Account" items={account} />
      <Section title="Your OneShetland" items={activity} />
      {isAdmin && (
        <div>
          <p className="mb-2 px-3 text-xs font-bold uppercase tracking-widest text-ink-faint">Admin</p>
          <Link href="/admin" className="flex items-center justify-between rounded-lg bg-rose-600 px-3 py-2 text-sm font-bold text-white transition hover:brightness-95">
            Control centre <span>→</span>
          </Link>
        </div>
      )}
      <form action="/auth/sign-out" method="post" className="px-3 pt-2">
        <button type="submit" className="text-sm font-semibold text-rose-600 hover:underline">Sign out</button>
      </form>
    </nav>
  );
}
