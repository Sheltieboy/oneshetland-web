import Link from "next/link";
import { getActiveCampaigns } from "@/lib/hubs-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fundraising" };

const ACCENT = "#2a8b5c";

export default async function CampaignsPage() {
  const campaigns = await getActiveCampaigns();

  return (
    <>
      {/* Header band */}
      <section className="relative isolate overflow-hidden text-paper" style={{ background: ACCENT }}>
        <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
          <Link href="/hubs" className="text-sm font-semibold text-paper/80 transition hover:text-paper">← Hubs</Link>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Chip in</h1>
          <p className="mt-2 max-w-xl text-paper/85">
            Live fundraising appeals from community hubs and charities across Shetland. Every donation goes straight to the group.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8">
        {campaigns.length === 0 ? (
          <div className="rounded-2xl border border-line bg-paper p-10 text-center">
            <p className="text-lg font-semibold text-ink">No live appeals right now</p>
            <p className="mt-1 text-ink-muted">Check back soon, or <Link href="/hubs" className="font-semibold underline">browse hubs</Link> to find a group to support.</p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((c) => {
              const pct = c.goal_pence > 0 ? Math.min(100, Math.round((c.raised_pence / c.goal_pence) * 100)) : 0;
              const bar = c.hub_color || ACCENT;
              return (
                <li key={c.id}>
                  <Link
                    href={`/hubs/campaign/${c.id}`}
                    className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-soft transition hover:shadow-lift"
                  >
                    {c.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.cover_url} alt="" className="h-36 w-full object-cover" />
                    ) : (
                      <div className="h-36 w-full" style={{ background: `color-mix(in srgb, ${bar} 22%, transparent)` }} />
                    )}
                    <div className="flex flex-1 flex-col p-4">
                      <div className="flex items-center gap-2 text-[11px] font-semibold text-ink-muted">
                        <span className="grid h-5 w-5 shrink-0 place-items-center overflow-hidden rounded-full" style={{ background: `color-mix(in srgb, ${bar} 18%, transparent)` }}>
                          {c.hub_logo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.hub_logo} alt="" className="h-full w-full object-cover" />
                          ) : null}
                        </span>
                        <span className="truncate">{c.hub_name}</span>
                        {c.hub_is_charity && <span className="rounded-pill bg-sand px-1.5 py-0.5 text-[10px] text-ink-soft">Charity</span>}
                      </div>
                      <h2 className="mt-2 line-clamp-2 font-bold text-ink">{c.title}</h2>
                      <div className="mt-auto pt-3">
                        <span className="block h-1.5 w-full overflow-hidden rounded-full bg-ink/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                          <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: bar }} />
                        </span>
                        <p className="mt-1.5 text-xs text-ink-muted">
                          <b className="text-ink">£{Math.round(c.raised_pence / 100).toLocaleString()}</b> of £{Math.round(c.goal_pence / 100).toLocaleString()} · {pct}%
                          {c.donor_count > 0 && ` · ${c.donor_count} ${c.donor_count === 1 ? "donor" : "donors"}`}
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
