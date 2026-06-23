import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { getMyHubs } from "@/lib/hubs-server";
import { hubAccent, HUB_TYPE_LABELS, HUB_COLOR } from "@/lib/hubs-data";
import { HubTypeIcon } from "@/components/hubs/HubTypeIcon";

export const dynamic = "force-dynamic";
export const metadata = { title: "My hubs" };

export default async function MyHubsPage() {
  const account = await getAccount();
  if (!account) redirect("/sign-in?next=/account/hubs");

  const hubs = await getMyHubs();

  return (
    <>
      <section className="text-paper" style={{ background: HUB_COLOR }}>
        <div className="mx-auto max-w-3xl px-5 py-10 sm:py-12">
          <Link href="/account" className="text-sm font-semibold text-paper/80 hover:text-paper">← My account</Link>
          <h1 className="mt-3 font-display text-4xl font-bold">My hubs</h1>
          <p className="mt-2 text-paper/85">Hubs you own or help run.</p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-5 py-10 sm:py-12">
        {hubs.length === 0 ? (
          <div className="rounded-xl border border-line bg-paper p-12 text-center shadow-soft">
            <h2 className="font-display text-xl font-bold">You don&apos;t run any hubs yet</h2>
            <p className="mx-auto mt-2 max-w-md text-ink-soft">Start one for your club, group or organisation — it&apos;s free.</p>
            <Link href="/hubs/new" className="mt-6 inline-block rounded-pill px-5 py-3 font-semibold text-paper" style={{ background: HUB_COLOR }}>
              Start a hub
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {hubs.map((h) => {
              const accent = hubAccent(h);
              return (
                <li key={h.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-paper p-4 shadow-soft">
                  <Link href={`/hubs/${h.slug || h.id}`} className="flex min-w-0 items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-line" style={{ color: accent }}>
                      {h.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={h.logo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <HubTypeIcon type={h.type} className="h-5 w-5" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-display text-lg font-bold text-ink">{h.name}</span>
                      <span className="block text-sm text-ink-muted">{HUB_TYPE_LABELS[h.type]}</span>
                    </span>
                  </Link>
                  <Link href={`/hubs/${h.slug || h.id}/manage`} className="shrink-0 rounded-pill px-4 py-2 text-sm font-semibold text-paper" style={{ background: accent }}>
                    Manage
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
