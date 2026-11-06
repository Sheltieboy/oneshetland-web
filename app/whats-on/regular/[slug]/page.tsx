import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getActivityDetail } from "@/lib/activities-data";
import { SessionList } from "@/components/activities/SessionList";
import { FollowButton } from "@/components/activities/FollowButton";
import { WhatsOnTabs } from "@/components/activities/WhatsOnTabs";
import { REGULAR } from "@/components/activities/tokens";
import { CATEGORY_LABEL, dayShort, patternText } from "@/lib/activities";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = await getActivityDetail(slug);
  if (!d || d.activity.status !== "published" || d.activity.admin_paused) return { title: "Regular activity" };
  return { title: `${d.activity.title} · Regular activities`, description: d.activity.description?.slice(0, 160) ?? `${patternText(d.rules)}${d.activity.venue ? ` at ${d.activity.venue}` : ""}.` };
}

export default async function ActivityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const now = new Date();
  const d = await getActivityDetail(slug, now);
  if (!d) notFound();
  const { activity: a, owner, rules, sessions } = d;
  const isPublic = a.status === "published" && !a.admin_paused;
  const ownerHref = owner.kind === "hub" ? `/hubs/${owner.slug || owner.id}` : owner.kind === "business" ? `/directory/${owner.slug || owner.id}` : null;
  const manageHref = d.canManage
    ? owner.kind === "hub" ? `/hubs/${owner.slug || owner.id}/manage/activities/${a.id}` : owner.kind === "business" ? `/business/${owner.id}/manage/activities/${a.id}` : "/admin/activities"
    : null;
  const place = [a.venue, a.locality].filter(Boolean).join(", ");
  const upcoming = sessions.slice(0, 24);

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/whats-on/regular" className="text-sm font-semibold text-ink-soft hover:text-ink">← Regular activities</Link>
        <WhatsOnTabs active="regular" />
      </div>

      {!isPublic && (
        <div role="status" className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <strong>Only you can see this.</strong>{" "}
          {a.admin_paused ? "OneShetland has paused this listing." : a.status === "draft" ? "It's a draft. Publish it from Manage when it's ready." : "It has ended."}
          {manageHref && <> <Link href={manageHref} className="font-bold underline">Open Manage</Link></>}
        </div>
      )}

      <p className="mt-6 text-xs font-bold uppercase tracking-widest" style={{ color: REGULAR }}>{CATEGORY_LABEL[a.category] ?? "Activity"}{a.audience ? ` · ${a.audience}` : ""}</p>
      <h1 className="mt-1 font-display text-4xl font-bold leading-tight sm:text-5xl">{a.title}</h1>
      <p className="mt-2 text-ink-soft">
        {owner.kind === "platform" ? "Listed by OneShetland" : <>Run by {ownerHref ? <Link href={ownerHref} className="font-semibold underline underline-offset-2">{owner.name}</Link> : owner.name}</>}
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_18rem]">
        <div className="space-y-8">
          <section aria-labelledby="when-h">
            <h2 id="when-h" className="font-display text-xl font-bold">When</h2>
            <p className="mt-1 text-lg font-semibold text-ink">{patternText(rules)}</p>
            {(a.active_from || a.active_until) && <p className="text-sm text-ink-muted">{a.active_from ? `From ${dayShort(`${a.active_from}T12:00:00Z`)}` : ""}{a.active_until ? `${a.active_from ? " " : ""}until ${dayShort(`${a.active_until}T12:00:00Z`)}` : ""}</p>}
            <div className="mt-4"><SessionList sessions={upcoming} defaultVenue={a.venue} /></div>
            {sessions.length > upcoming.length && <p className="mt-2 text-sm text-ink-muted">Showing the next {upcoming.length} sessions.</p>}
          </section>

          {a.description && (
            <section aria-labelledby="about-h">
              <h2 id="about-h" className="font-display text-xl font-bold">About</h2>
              <p className="mt-1 whitespace-pre-line text-ink-soft">{a.description}</p>
            </section>
          )}
        </div>

        <aside className="space-y-5">
          <section className="rounded-card border border-line bg-paper p-4 shadow-soft" aria-labelledby="join-h">
            <h2 id="join-h" className="font-display text-lg font-bold">How to join</h2>
            {a.booking_mode === "drop_in" && <p className="mt-1 text-sm text-ink-soft">Just turn up. No booking needed.</p>}
            {a.booking_mode === "contact" && <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">Get in touch first: {a.contact_info}</p>}
            {a.booking_mode === "link" && a.booking_url && <a href={a.booking_url} rel="noopener noreferrer" className="mt-2 inline-block rounded-pill px-5 py-2.5 text-sm font-bold text-paper" style={{ background: REGULAR }}>Book on their website</a>}
            {a.price_text && <p className="mt-3 text-sm"><span className="font-semibold text-ink">Cost:</span> <span className="text-ink-soft">{a.price_text}</span></p>}
            {a.booking_mode !== "contact" && a.contact_info && <p className="mt-2 whitespace-pre-line text-sm text-ink-soft">{a.contact_info}</p>}
          </section>
          {place && (
            <section className="rounded-card border border-line bg-paper p-4 shadow-soft" aria-labelledby="where-h">
              <h2 id="where-h" className="font-display text-lg font-bold">Where</h2>
              <p className="mt-1 text-sm text-ink-soft">{place}</p>
              {a.lat != null && a.lng != null && <a href={`https://www.google.com/maps/search/?api=1&query=${a.lat},${a.lng}`} rel="noopener noreferrer" className="mt-1 inline-block text-sm font-semibold underline underline-offset-2">Open in Maps</a>}
            </section>
          )}
          {isPublic && <FollowButton activityId={a.id} slug={a.slug} signedIn={d.signedIn} following={d.following} />}
          {manageHref && isPublic && <Link href={manageHref} className="block text-sm font-semibold text-ink-soft underline underline-offset-2">Manage this activity</Link>}
        </aside>
      </div>
    </div>
  );
}
