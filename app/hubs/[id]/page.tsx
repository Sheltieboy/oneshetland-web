import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getHub,
  getMembershipTypes,
  getHubNotices,
  getActiveCampaign,
  getHubDocuments,
  getCampaignDonors,
  getHubEvents,
  hubAccent,
  membershipPrice,
  isMembershipActive,
  HUB_TYPE_LABELS,
  HUB_COLOR,
} from "@/lib/hubs-data";
import { getAccount } from "@/lib/auth";
import { getMyMembership, isHubAdmin, getHubDirectory } from "@/lib/hubs-server";
import { HubMembershipPanel } from "@/components/hubs/HubMembershipPanel";
import { DirectoryButton, CampaignSidebar } from "@/components/hubs/HubSidebarActions";
import { TrackView } from "@/components/analytics/TrackView";
import { ContactLink } from "@/components/analytics/ContactLink";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hub = await getHub(id);
  return {
    title: hub?.name ?? "Hub",
    description: hub?.description ?? undefined,
  };
}

export default async function HubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hub = await getHub(id);
  if (!hub) notFound();

  const accent = hubAccent(hub);
  const [tiers, notices, campaign, documents, events, account, membership, admin] = await Promise.all([
    getMembershipTypes(hub.id),
    getHubNotices(hub.id),
    getActiveCampaign(hub.id),
    getHubDocuments(hub.id),
    getHubEvents(hub.id),
    getAccount(),
    getMyMembership(hub.id),
    isHubAdmin(hub.id),
  ]);
  const donors = campaign ? await getCampaignDonors(campaign.id) : [];
  const isMember = admin.isAdmin || (!!membership && isMembershipActive(membership));
  const directoryMembers = hub.directory_enabled && isMember ? await getHubDirectory(hub.id) : [];

  return (
    <>
      <TrackView event="content_viewed" objectType="hub" objectId={id} hubId={id} />
      {/* Branded hero */}
      <section className="relative isolate overflow-hidden text-paper" style={{ background: accent }}>
        {hub.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hub.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
        )}
        <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${accent}e6, ${accent}99 55%, ${accent}55)` }} />
        <div className="relative mx-auto max-w-4xl px-5 py-12 sm:py-14">
          <div className="flex items-center justify-between gap-3">
            <Link href="/hubs" className="inline-flex items-center gap-1.5 text-sm font-semibold text-paper/85 transition hover:text-paper">
              <span aria-hidden>←</span> All hubs
            </Link>
            {admin.isAdmin && (
              <Link href={`/hubs/${hub.slug || hub.id}/manage`} className="rounded-pill bg-paper/20 px-4 py-1.5 text-sm font-semibold text-paper transition hover:bg-paper/30">
                Manage hub
              </Link>
            )}
          </div>
          <div className="mt-5 flex items-end gap-4">
            <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border-4 border-paper bg-paper shadow-lift sm:h-24 sm:w-24">
              {hub.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={hub.logo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full w-full place-items-center font-display text-3xl font-bold text-paper" style={{ background: accent }}>
                  {hub.name.slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div className="pb-1">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-3xl font-bold leading-none sm:text-4xl">{hub.name}</h1>
                {hub.is_verified && <span title="Verified hub" className="text-lg">✓</span>}
              </div>
              <p className="mt-1.5 text-paper/90">
                {HUB_TYPE_LABELS[hub.type]}
                {hub.area ? ` · ${hub.area}` : ""}
                {typeof hub.member_count === "number" && hub.member_count > 0
                  ? ` · ${hub.member_count} member${hub.member_count === 1 ? "" : "s"}`
                  : ""}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-4xl gap-8 px-5 py-10 sm:py-12 lg:grid-cols-[1fr_18rem]">
        {/* Main column */}
        <div className="space-y-8">
          {hub.description && (
            <section>
              <h2 className="font-display text-2xl font-bold">About</h2>
              <p className="mt-3 whitespace-pre-line leading-relaxed text-ink-soft">{hub.description}</p>
            </section>
          )}

          {/* Membership tiers */}
          {tiers.length > 0 && (
            <section>
              <h2 className="font-display text-2xl font-bold">Membership</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {tiers.map((t) => (
                  <div key={t.id} className="rounded-xl border border-line bg-paper p-5 shadow-soft">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="font-display text-lg font-bold">{t.name}</h3>
                      <span className="font-display text-lg font-bold" style={{ color: accent }}>
                        {membershipPrice(t.price_pence, t.period)}
                      </span>
                    </div>
                    {t.description && <p className="mt-1 text-sm text-ink-soft">{t.description}</p>}
                    {t.benefits && (
                      <ul className="mt-3 space-y-1 text-sm text-ink-soft">
                        {t.benefits.split("\n").filter(Boolean).map((b, i) => (
                          <li key={i} className="flex gap-2">
                            <span style={{ color: accent }}>✓</span> {b}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Notices */}
          {notices.length > 0 && (
            <section>
              <h2 className="font-display text-2xl font-bold">Notices</h2>
              <div className="mt-4 space-y-3">
                {notices.map((n) => (
                  <article key={n.id} className="rounded-xl border border-line bg-paper p-5 shadow-soft">
                    <div className="flex items-center gap-2">
                      {n.is_pinned && <span title="Pinned" style={{ color: accent }}>📌</span>}
                      <h3 className="font-display text-lg font-bold">{n.title}</h3>
                      {n.visibility === "members" && (
                        <span className="rounded-pill bg-sand px-2 py-0.5 text-xs font-semibold text-ink-muted">Members</span>
                      )}
                    </div>
                    {n.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={n.image_url} alt="" className="mt-3 max-h-64 w-full rounded-lg object-cover" />
                    )}
                    {n.body && <p className="mt-2 whitespace-pre-line text-ink-soft">{n.body}</p>}
                    <p className="mt-2 text-xs text-ink-muted">
                      {new Date(n.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* Upcoming events */}
          {events.length > 0 && (
            <section>
              <h2 className="font-display text-2xl font-bold">Upcoming events</h2>
              <div className="mt-4 space-y-3">
                {events.map((ev) => (
                  <Link key={ev.id} href={`/whats-on/${ev.id}`} className="flex items-center gap-4 rounded-xl border border-line bg-paper p-4 shadow-soft transition hover:border-current" style={{ color: accent }}>
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg text-center text-paper" style={{ background: accent }}>
                      <span className="text-xs font-bold leading-none">
                        {new Date(ev.starts_at).toLocaleDateString("en-GB", { day: "numeric" })}
                        <br />
                        {new Date(ev.starts_at).toLocaleDateString("en-GB", { month: "short" })}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="block truncate font-display text-lg font-bold text-ink">{ev.title}</span>
                      <span className="block text-sm text-ink-muted">
                        {new Date(ev.starts_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        {ev.venue ? ` · ${ev.venue}` : ""}
                        {ev.hub_visibility === "members" ? " · Members" : ""}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          {/* Membership / join */}
          <HubMembershipPanel
            hubId={hub.id}
            hubName={hub.name}
            accent={accent}
            joinMode={hub.join_mode}
            tiers={tiers}
            membership={membership}
            isLoggedIn={!!account}
            signInHref={`/sign-in?next=/hubs/${hub.slug || hub.id}`}
          />

          {/* Member directory — slide-over */}
          {hub.directory_enabled && isMember && (
            <DirectoryButton
              hubId={hub.id}
              hubSlug={hub.slug || hub.id}
              accent={accent}
              members={directoryMembers as { user_id: string; name: string; role: string; tier?: string | null }[]}
            />
          )}

          {/* Active campaign — donate modal inline */}
          {campaign && (
            <CampaignSidebar
              campaign={campaign}
              donors={donors as { name: string | null; amount_pence: number; is_anonymous: boolean }[]}
              hubName={hub.name}
              accent={accent}
              isCharity={hub.is_charity && !!hub.charity_number}
              isLoggedIn={!!account}
              signInHref={`/sign-in?next=/hubs/${hub.slug || hub.id}`}
            />
          )}

          {/* Contact */}
          {(hub.contact_email || hub.contact_phone || hub.website) && (
            <div className="rounded-xl border border-line bg-paper p-5 shadow-soft">
              <p className="eyebrow text-ink-muted">Get in touch</p>
              <ul className="mt-3 space-y-2 text-sm">
                {hub.contact_phone && (
                  <li><ContactLink objectType="hub" objectId={id} hubId={id} method="phone" href={`tel:${hub.contact_phone}`} className="font-semibold text-ink hover:underline">{hub.contact_phone}</ContactLink></li>
                )}
                {hub.contact_email && (
                  <li><ContactLink objectType="hub" objectId={id} hubId={id} method="email" href={`mailto:${hub.contact_email}`} className="font-semibold text-ink hover:underline">{hub.contact_email}</ContactLink></li>
                )}
                {hub.website && (
                  <li>
                    <ContactLink objectType="hub" objectId={id} hubId={id} method="website" href={hub.website} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline" style={{ color: accent }}>
                      Website ↗
                    </ContactLink>
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Documents */}
          {documents.length > 0 && (
            <div className="rounded-xl border border-line bg-paper p-5 shadow-soft">
              <p className="eyebrow text-ink-muted">Documents</p>
              <ul className="mt-3 space-y-2 text-sm">
                {documents.map((d) => (
                  <li key={d.id}>
                    <a href={d.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink hover:underline">
                      📄 {d.title}
                    </a>
                    {d.visibility === "members" && <span className="ml-2 text-xs text-ink-muted">(members)</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Charity badge */}
          {hub.is_charity && (
            <div className="rounded-xl border border-line bg-sand/40 p-4 text-sm text-ink-soft">
              <span className="font-semibold text-ink">Registered charity</span>
              {hub.charity_number ? <> · {hub.charity_number}</> : null}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
