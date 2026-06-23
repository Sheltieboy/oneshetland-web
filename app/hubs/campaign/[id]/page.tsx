import Link from "next/link";
import { notFound } from "next/navigation";
import { getCampaign, getHub, getCampaignDonors, hubAccent } from "@/lib/hubs-data";
import { getAccount } from "@/lib/auth";
import { gbp } from "@/lib/stripe";
import { CampaignDonate } from "@/components/hubs/CampaignDonate";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCampaign(id);
  return { title: c?.title ?? "Campaign" };
}

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign) notFound();

  const [hub, donors, account] = await Promise.all([
    getHub(campaign.hub_id),
    getCampaignDonors(campaign.id),
    getAccount(),
  ]);
  if (!hub) notFound();

  const accent = hubAccent(hub);
  const pct = Math.min(100, Math.round((campaign.raised_pence / campaign.goal_pence) * 100));

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden text-paper" style={{ background: accent }}>
        {campaign.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={campaign.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
        )}
        <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${accent}f2, ${accent}c0 55%, ${accent}99)` }} />
        <div className="relative mx-auto max-w-4xl px-5 py-12 sm:py-14">
          <Link href={`/hubs/${hub.slug || hub.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-paper/85 transition hover:text-paper">
            <span aria-hidden>←</span> {hub.name}
          </Link>
          <h1 className="mt-3 font-display text-4xl font-bold leading-tight sm:text-5xl">{campaign.title}</h1>
          <p className="mt-2 text-paper/85">Fundraising for {hub.name}</p>
        </div>
      </section>

      <div className="mx-auto grid max-w-4xl gap-8 px-5 py-10 sm:py-12 lg:grid-cols-[1fr_18rem]">
        {/* Story */}
        <div className="space-y-6">
          {campaign.story ? (
            <section>
              <h2 className="font-display text-2xl font-bold">About this campaign</h2>
              <p className="mt-3 whitespace-pre-line leading-relaxed text-ink-soft">{campaign.story}</p>
            </section>
          ) : null}

          {donors.length > 0 && (
            <section>
              <h2 className="font-display text-2xl font-bold">Supporters</h2>
              <ul className="mt-4 space-y-2">
                {donors.map((d, i) => (
                  <li key={i} className="rounded-xl border border-line bg-paper p-4 shadow-soft">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-ink">{d.is_anonymous ? "Anonymous" : d.name}</span>
                      <span className="font-display font-bold" style={{ color: accent }}>{gbp(d.amount_pence)}</span>
                    </div>
                    {d.message && <p className="mt-1 text-sm text-ink-soft">“{d.message}”</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Donate sidebar */}
        <aside>
          <div className="sticky top-20 rounded-xl border border-line bg-paper p-5 shadow-soft">
            <div className="font-display text-3xl font-bold">{gbp(campaign.raised_pence)}</div>
            <p className="text-sm text-ink-muted">raised of {gbp(campaign.goal_pence)} goal</p>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-sand">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: accent }} />
            </div>
            <p className="mt-2 text-sm text-ink-soft">
              {pct}% · {campaign.donor_count} supporter{campaign.donor_count === 1 ? "" : "s"}
            </p>
            <div className="mt-5">
              <CampaignDonate
                campaignId={campaign.id}
                hubName={hub.name}
                accent={accent}
                isCharity={hub.is_charity && !!hub.charity_number}
                isLoggedIn={!!account}
                signInHref={`/sign-in?next=/hubs/campaign/${campaign.id}`}
                closed={campaign.status === "closed"}
              />
            </div>
            {hub.is_charity && !!hub.charity_number && (
              <p className="mt-3 text-center text-xs text-ink-muted">Gift Aid available — boost your donation by 25%.</p>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
