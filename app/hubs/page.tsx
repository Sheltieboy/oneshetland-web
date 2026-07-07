import Link from "next/link";
import { getHubs, getHubTypeCounts, HUB_TYPES, HUB_TYPE_LABELS, HUB_COLOR, type HubType } from "@/lib/hubs-data";
import { HubSearchGrid } from "@/components/hubs/HubSearchGrid";
import { getAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Hubs" };

export default async function HubsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type: rawType } = await searchParams;
  const type = HUB_TYPES.includes(rawType as HubType) ? (rawType as HubType) : undefined;

  const [hubs, counts, account] = await Promise.all([
    getHubs(type),
    getHubTypeCounts(),
    getAccount(),
  ]);

  const chip = (label: string, href: string, on: boolean) => (
    <Link
      key={label}
      href={href}
      className={
        "shrink-0 rounded-pill px-4 py-2 text-sm font-semibold transition " +
        (on ? "text-paper shadow-soft" : "border border-line-strong text-ink-soft hover:bg-sand")
      }
      style={on ? { background: HUB_COLOR } : undefined}
    >
      {label}
    </Link>
  );

  return (
    <>
      {/* Header band */}
      <section className="relative isolate overflow-hidden text-paper" style={{ background: HUB_COLOR }}>
        <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${HUB_COLOR}f2, ${HUB_COLOR}c0 60%, ${HUB_COLOR}99)` }} />
        <div className="relative mx-auto max-w-6xl px-5 py-14 sm:py-16">
          <p className="eyebrow text-paper/85">Community</p>
          <h1 className="mt-2 font-display text-5xl font-bold leading-none sm:text-6xl">Hubs</h1>
          <p className="mt-4 max-w-2xl text-lg text-paper/90">
            A simple branded home for Shetland clubs, groups, charities and
            community organisations.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 py-10 sm:py-12">
        {/* Start a Hub */}
        <Link
          href={account ? "/hubs/new" : "/sign-in?next=/hubs/new"}
          className="group flex items-center gap-4 rounded-2xl px-6 py-5 text-paper shadow-soft transition hover:brightness-95"
          style={{ background: HUB_COLOR }}
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-paper/20 text-2xl font-bold">+</span>
          <span className="flex-1">
            <span className="block font-display text-xl font-bold">Start a Hub</span>
            <span className="block text-paper/85">Free for your club, group or organisation</span>
          </span>
          <span aria-hidden className="text-2xl text-paper/80 transition group-hover:translate-x-0.5">›</span>
        </Link>

        {/* Type filter */}
        <div className="-mx-5 mt-8 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {chip("All", "/hubs", !type)}
          {HUB_TYPES.map((t) =>
            counts[t] ? chip(HUB_TYPE_LABELS[t], `/hubs?type=${t}`, type === t) : null,
          )}
        </div>

        {/* Search + grid (client-side keyword filter) */}
        <HubSearchGrid hubs={hubs} typeFiltered={!!type} />
      </div>
    </>
  );
}
