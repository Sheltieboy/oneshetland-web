import Link from "next/link";
import { currentUserId, getMyListing, requireHouseSwaps } from "@/lib/house-swaps-data";
import {
  EMPTY_ADVERT, HOUSE_SWAPS_DISCLAIMER, advertFromListing, advertStateText, daysLeft, displayHeadline, formatDate, signInHref,
} from "@/lib/house-swaps";
import { Disclaimer, Panel, SwapsHeader, SwapsNav, btnPrimary, btnSecondary } from "@/components/house-swaps/Shell";
import { MyAdvertForm } from "@/components/house-swaps/MyAdvertForm";
import { PhotoManager } from "@/components/house-swaps/PhotoManager";
import { StatusControls } from "@/components/house-swaps/StatusControls";
import { Notice } from "@/components/notices/NoticesShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "House Swaps · My advert" };

const TONE: Record<string, string> = { ok: "border-emerald-300 bg-emerald-50", wait: "border-amber-300 bg-amber-50", paused: "border-line-strong bg-sand/60", bad: "border-rose-300 bg-rose-50" };

/** The member's dashboard: status, expiry, controls, and the create/edit form. */
export default async function MyAdvertPage() {
  await requireHouseSwaps();
  const userId = await currentUserId();
  if (!userId) {
    return (
      <>
        <SwapsHeader title="My advert" />
        <SwapsNav current="my" />
        <div className="mx-auto max-w-3xl px-5 py-10">
          <Panel>
            <h2 className="font-display text-2xl font-bold text-ink">Sign in to add or manage your advert</h2>
            <p className="mt-2 text-ink-soft">It is free. We only ever show a broad area, bedrooms and type of home: never your name, address or contact details.</p>
            <Link href={signInHref("/house-swaps/my")} className={`${btnPrimary} mt-4`}>Sign in or join</Link>
          </Panel>
        </div>
      </>
    );
  }
  const mine = await getMyListing();
  const l = mine.ok ? mine.data : null;
  const state = l ? advertStateText(l) : null;
  const left = l ? daysLeft(l.expires_at) : 0;

  return (
    <>
      <SwapsHeader title={l ? "My advert" : "Add your advert"} intro={l ? displayHeadline(l) : "It's free, and takes a few minutes. We only show a broad area, bedrooms and type of home."} />
      <SwapsNav current="my" unread={l?.unread_enquiries ?? 0} />
      <div className="mx-auto max-w-6xl px-5 py-8 sm:py-10">
        {!mine.ok && <Notice tone="error">Your advert could not be loaded just now ({mine.error}).</Notice>}

        {l && state && (
          <div className="mb-8 space-y-4">
            <div className={`rounded-card border p-5 ${TONE[state.tone]}`}>
              <p className="text-[11px] font-black uppercase tracking-widest text-ink-muted">Status</p>
              <h2 className="mt-1 font-display text-2xl font-bold text-ink">{state.title}</h2>
              <p className="mt-1 text-sm text-ink-soft">{state.body}</p>
              {l.is_public && (
                <p className="mt-3 text-sm font-semibold text-ink">
                  Shown until {formatDate(l.expires_at)}{left <= 14 ? ` (${left <= 0 ? "today" : left === 1 ? "1 day left" : `${left} days left`})` : ""}. <span className="font-normal text-ink-soft">Confirm that it&apos;s still available to keep it on the noticeboard.</span>
                </p>
              )}
              {l.is_public && <p className="mt-3"><Link href={`/house-swaps/${l.id}`} className="inline-flex min-h-[44px] items-center text-sm font-bold text-navy-light underline">See your advert as others see it</Link></p>}
            </div>
            <Panel aria-labelledby="ctl">
              <h2 id="ctl" className="font-display text-xl font-bold text-ink">Look after your advert</h2>
              <div className="mt-3"><StatusControls status={l.status === "paused" ? "paused" : "active"} emphasiseConfirm={left <= 14 || !l.is_public} photoPaths={l.photos.map((p) => p.path)} canConfirm={l.moderation_state !== "rejected" && l.moderation_state !== "hidden"} /></div>
            </Panel>
            <div className="grid gap-3 sm:grid-cols-2">
              <Link href="/house-swaps/messages" className="flex min-h-[56px] items-center justify-between rounded-card border border-line bg-paper px-5 py-3 shadow-soft hover:shadow-lift">
                <span className="font-bold text-ink">Messages</span>
                {l.unread_enquiries > 0
                  ? <span className="rounded-pill bg-rose-600 px-2.5 py-0.5 text-sm font-bold text-white">{l.unread_enquiries}<span className="sr-only"> unread</span></span>
                  : <span className="text-sm text-ink-muted">No new messages</span>}
              </Link>
              <Link href="/house-swaps/matches" className="flex min-h-[56px] items-center justify-between rounded-card border border-line bg-paper px-5 py-3 shadow-soft hover:shadow-lift">
                <span className="font-bold text-ink">Possible matches</span>
                <span className="text-sm text-ink-muted">{l.is_public ? "See who may suit" : "Once your advert is live"}</span>
              </Link>
            </div>
          </div>
        )}

        {!l && mine.ok && (
          <div className="mb-6 rounded-card border border-line bg-sand/60 p-5 text-sm text-ink-soft">
            <p className="font-semibold text-ink">You don&apos;t have an advert yet.</p>
            <p className="mt-1">Each member can have one advert, for the home they live in. {HOUSE_SWAPS_DISCLAIMER}</p>
            <p className="mt-2"><Link href="/house-swaps" className="font-semibold underline">Browse the noticeboard first</Link> or <Link href="/house-swaps/about" className="font-semibold underline">read how it works</Link>.</p>
          </div>
        )}

        <h2 className="mb-4 font-display text-3xl font-bold text-ink">{l ? "Edit your advert" : "Your advert"}</h2>
        {l && <p className="mb-4 text-sm text-ink-muted">Move through the three steps and choose Save changes on the last one. Photos are saved as soon as you add them.</p>}
        <MyAdvertForm
          key="advert"
          initial={l ? advertFromListing(l) : EMPTY_ADVERT}
          editing={!!l}
          userId={userId}
          photosSlot={l ? <PhotoManager photos={l.photos} userId={userId} /> : null}
        />
        {l && <div className="mt-8"><Disclaimer /></div>}
        <p className="mt-6"><Link href="/house-swaps" className={btnSecondary}>Back to the noticeboard</Link></p>
      </div>
    </>
  );
}
