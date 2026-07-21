import Link from "next/link";
import { getLoyaltyBusinesses, getActiveOffers, offerBadge, type LoyaltyBiz } from "@/lib/local-data";
import { SafeImage } from "@/components/ui/SafeImage";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Shop Local Shetland — loyalty & rewards",
  description:
    "Collect stamps, earn points and grab local deals at Shetland businesses — all in one place, on OneShetland.",
};

const LOYAL = "#7c3aed";

const CATEGORY_EMOJI: Record<string, string> = {
  food_drink: "🍽",
  retail: "🛍",
  services: "🔧",
  tourism: "🌅",
  accommodation: "🛏",
  other: "📍",
};

/** One-line summary of what a card earns you, in plain English. */
function rewardLine(p: LoyaltyBiz["program"]): string {
  if (p.type === "points") {
    const per = p.points_for_pound ?? 100;
    const rate = p.points_per_pound ?? 1;
    return `Earn ${rate} point${rate === 1 ? "" : "s"} per £1 · ${per} points = £1 off`;
  }
  const n = p.stamps_required ?? 10;
  const reward = p.stamp_reward?.trim();
  return reward ? `Collect ${n} stamps → ${reward}` : `Collect ${n} stamps for a reward`;
}

/** Best-effort Shetland locality from a free-text address: the last
 *  comma-separated part that isn't a country, "Shetland", or a postcode. */
function localityOf(address: string | null): string | null {
  if (!address) return null;
  const drop = /^(uk|u\.k\.|united kingdom|great britain|gb|scotland|shetland|shetland islands|ze\d?\s*\d?[a-z]{0,2})$/i;
  const parts = address
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && !drop.test(s));
  return parts.length ? parts[parts.length - 1] : null;
}

export default async function LoyaltyHubPage() {
  const [businesses, offers] = await Promise.all([
    getLoyaltyBusinesses(120),
    getActiveOffers(60),
  ]);

  const stampCount = businesses.filter((b) => b.program.type === "stamps").length;
  const pointsCount = businesses.filter((b) => b.program.type === "points").length;
  const areas = new Set(
    businesses.map((b) => localityOf(b.business.address)).filter(Boolean) as string[],
  );

  const stats: { n: number | string; label: string }[] = [
    { n: businesses.length, label: businesses.length === 1 ? "business rewarding you" : "businesses rewarding you" },
    { n: offers.length, label: offers.length === 1 ? "live deal" : "live deals" },
    { n: areas.size || "—", label: "corners of Shetland" },
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 pb-20 pt-6">
      {/* Hero */}
      <section
        className="overflow-hidden rounded-card p-6 text-paper shadow-soft sm:p-9"
        style={{ background: `linear-gradient(135deg, ${LOYAL} 0%, #4f46e5 55%, #0ea5e9 100%)` }}
      >
        <span className="inline-block rounded-pill bg-paper/20 px-3 py-1 text-xs font-bold uppercase tracking-wide">
          Shop Local Shetland
        </span>
        <h1 className="mt-3 font-display text-3xl font-bold leading-tight sm:text-4xl">
          One card for every shop in Shetland
        </h1>
        <p className="mt-2 max-w-xl text-paper/90">
          Collect stamps, earn points and unlock deals at Shetland businesses — all
          in one place, no wallet full of paper cards. Every reward is here, from
          Lerwick to Unst.
        </p>
        <div className="mt-6 grid grid-cols-3 gap-3 sm:max-w-md">
          {stats.map((s) => (
            <div key={s.label} className="rounded-card bg-paper/15 px-3 py-3 text-center backdrop-blur-sm">
              <p className="font-display text-2xl font-bold sm:text-3xl">{s.n}</p>
              <p className="mt-0.5 text-[11px] font-semibold leading-tight text-paper/85">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mt-8">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: "📲", title: "Show your phone", body: "Open OneShetland at the till — no card to forget or lose." },
            { icon: "⭐️", title: "Collect as you spend", body: "A tap adds a stamp or points at any taking-part shop." },
            { icon: "🎁", title: "Redeem in seconds", body: "Staff scan your code and your reward is applied on the spot." },
          ].map((c) => (
            <div key={c.title} className="rounded-card border border-line bg-paper p-4 shadow-soft">
              <div className="text-2xl">{c.icon}</div>
              <p className="mt-2 font-display font-bold text-ink">{c.title}</p>
              <p className="mt-1 text-sm text-ink-muted">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Live deals */}
      {offers.length > 0 && (
        <section className="mt-10">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xl font-bold text-ink">Live deals across Shetland</h2>
            <Link href="/local" className="text-sm font-semibold" style={{ color: LOYAL }}>
              See all →
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {offers.map((o) => {
              const href = o.business?.slug ? `/directory/${o.business.slug}` : `/directory/${o.business_id}`;
              return (
                <Link
                  key={o.id}
                  href={href}
                  className="group flex flex-col rounded-card border border-line bg-paper p-4 shadow-soft transition hover:shadow-lift"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className="rounded-pill px-2.5 py-1 text-xs font-bold text-paper"
                      style={{ background: LOYAL }}
                    >
                      {offerBadge(o)}
                    </span>
                    {o.business?.name && (
                      <span className="truncate text-xs font-semibold text-ink-muted">{o.business.name}</span>
                    )}
                  </div>
                  <p className="mt-2 font-semibold text-ink group-hover:underline">{o.title}</p>
                  {o.description && <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{o.description}</p>}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Businesses rewarding loyalty */}
      <section className="mt-10">
        <h2 className="font-display text-xl font-bold text-ink">Places that reward your loyalty</h2>
        {businesses.length === 0 ? (
          <p className="mt-3 rounded-card border border-line bg-paper px-4 py-8 text-center text-sm text-ink-muted">
            The first Shetland loyalty cards are coming soon. Check back shortly.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {businesses.map(({ business, program }) => {
              const href = business.slug ? `/directory/${business.slug}` : `/directory/${business.id}`;
              const locality = localityOf(business.address);
              return (
                <Link
                  key={business.id}
                  href={href}
                  className="group flex gap-3 rounded-card border border-line bg-paper p-4 shadow-soft transition hover:shadow-lift"
                >
                  <div
                    className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-card text-lg"
                    style={{ background: `${business.brand_color ?? LOYAL}1a` }}
                  >
                    {business.logo_url ? (
                      <SafeImage src={business.logo_url} alt="" className="h-full w-full object-cover" fallback={<span>{CATEGORY_EMOJI[business.category ?? "other"] ?? "📍"}</span>} />
                    ) : (
                      <span>{CATEGORY_EMOJI[business.category ?? "other"] ?? "📍"}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold text-ink group-hover:underline">{business.name}</span>
                      <span
                        className="shrink-0 rounded-pill px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                        style={{ background: `${LOYAL}1a`, color: LOYAL }}
                      >
                        {program.type === "points" ? "Points" : "Stamps"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-ink-muted">{rewardLine(program)}</p>
                    {locality && <p className="mt-1 text-xs font-semibold text-ink-soft">{locality}</p>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Business CTA */}
      <section className="mt-12 rounded-card border border-line bg-sand p-6 text-center shadow-soft">
        <h2 className="font-display text-xl font-bold text-ink">Run a Shetland business?</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
          Set up a stamp card or points scheme in minutes and start rewarding regulars.
          No card printing, no card readers — just OneShetland.
        </p>
        <Link
          href="/business"
          className="mt-4 inline-block rounded-pill px-6 py-2.5 text-sm font-bold text-paper transition hover:brightness-95"
          style={{ background: LOYAL }}
        >
          Start rewarding customers
        </Link>
      </section>
    </main>
  );
}
