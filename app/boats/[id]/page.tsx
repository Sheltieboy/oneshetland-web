import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccount } from "@/lib/auth";
import {
  fetchVesselProfile, fetchVesselTimeline, fetchVesselComments, fetchVesselEdits,
  threadComments, vesselDisplayTitle, eventTypeLabel, BOATS,
} from "@/lib/boats-data";
import { getMyEditVotes } from "@/lib/boats-data.server";
import { BoatProfile } from "@/components/boats/BoatProfile";
import { BoatDiscussion } from "@/components/boats/BoatDiscussion";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await fetchVesselProfile(id);
  return { title: p ? `${vesselDisplayTitle(p.vessel)} · Da Boats` : "Boat" };
}

export default async function BoatDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await fetchVesselProfile(id);
  if (!profile) notFound();

  const account = await getAccount();
  const [timeline, comments, edits] = await Promise.all([fetchVesselTimeline(id), fetchVesselComments(id), fetchVesselEdits(id)]);
  const myVotes = account ? await getMyEditVotes(edits.map((e) => e.id)) : {};
  const hero = profile.media.find((m) => m.image_url || m.thumbnail_url);

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden text-paper" style={{ background: BOATS }}>
        {hero?.image_url && <img src={hero.image_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />}
        <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${BOATS}f2, ${BOATS}aa 55%, ${BOATS}55)` }} />
        <div className="relative mx-auto max-w-4xl px-5 py-12 sm:py-14">
          <Link href="/boats" className="text-sm font-semibold text-paper/85 hover:text-paper">← Da Boats</Link>
          <h1 className="mt-3 font-display text-4xl font-bold sm:text-5xl">{vesselDisplayTitle(profile.vessel)}</h1>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-5 py-10 sm:py-12 space-y-8">
        {/* Editable areas + suggest changes */}
        <BoatProfile profile={profile} edits={edits} myVotes={myVotes} isLoggedIn={!!account} userId={account?.id ?? null} />

        {/* Photos */}
        {profile.media.length > 0 && (
          <section className="rounded-card border border-line bg-paper p-6 shadow-soft">
            <h3 className="mb-3 font-display text-xl font-bold text-ink">Photos</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {profile.media.map((m) => {
                const src = m.image_url || m.thumbnail_url;
                const inner = src ? <img src={src} alt={m.title ?? ""} className="h-32 w-full rounded-card border border-line object-cover" /> : <div className="grid h-32 w-full place-items-center rounded-card border border-dashed border-line text-3xl opacity-30">⚓</div>;
                return m.page_url ? <a key={m.id} href={m.page_url} target="_blank" rel="noopener noreferrer" className="block transition hover:opacity-90">{inner}</a> : <div key={m.id}>{inner}</div>;
              })}
            </div>
            <p className="mt-2 text-xs text-ink-faint">Got a photo of her? Add it in the discussion below.</p>
          </section>
        )}

        {/* Story / timeline */}
        {timeline.length > 0 && (
          <section className="rounded-card border border-line bg-paper p-6 shadow-soft">
            <h3 className="mb-3 font-display text-xl font-bold text-ink">Her story</h3>
            <ol className="space-y-3">
              {timeline.map((t, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-14 shrink-0 font-display font-bold text-ink">{t.year ?? "—"}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{eventTypeLabel(t.item_type)}</p>
                    {t.description && <p className="text-sm text-ink-soft">{t.description}</p>}
                    {t.date_text && <p className="text-xs text-ink-faint">{t.date_text}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Discussion */}
        <BoatDiscussion vesselId={id} comments={threadComments(comments)} isLoggedIn={!!account} userId={account?.id ?? null} />
      </div>
    </>
  );
}
