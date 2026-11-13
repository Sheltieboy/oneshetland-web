import Link from "next/link";
import { getUnreadCount, requireHouseSwaps } from "@/lib/house-swaps-data";
import { CONTACT_RULE, HOUSE_SWAPS_INTRO, INTRODUCTIONS_ONLY } from "@/lib/house-swaps";
import { Disclaimer, Panel, SwapsHeader, SwapsNav, btnPrimary, btnSecondary } from "@/components/house-swaps/Shell";

export const dynamic = "force-dynamic";
export const metadata = { title: "House Swaps · How it works" };

export default async function AboutPage() {
  await requireHouseSwaps();
  const unread = await getUnreadCount();
  return (
    <>
      <SwapsHeader title="How House Swaps works" eyebrow="House Swaps" intro={<><p>{HOUSE_SWAPS_INTRO}</p><p className="mt-2 font-semibold">{INTRODUCTIONS_ONLY}</p></>} />
      <SwapsNav current="about" unread={unread} />
      <div className="mx-auto max-w-3xl space-y-6 px-5 py-8 sm:py-10">
        <Disclaimer />
        <Panel aria-labelledby="steps">
          <h2 id="steps" className="font-display text-2xl font-bold text-ink">In four steps</h2>
          <ol className="mt-4 space-y-4 text-base text-ink-soft">
            <li><strong className="text-ink">1. Add an advert.</strong> Say which part of Shetland your home is in, how many bedrooms it has, what type of home it is, and what you are looking for. It is free and takes a few minutes.</li>
            <li><strong className="text-ink">2. We check it.</strong> A member of our team reads every new advert, and any change to its wording or photos, before it appears. Adverts are shown for 90 days at a time; you confirm that yours is still available to keep it live.</li>
            <li><strong className="text-ink">3. Find each other.</strong> Browse the noticeboard, or look at your possible matches. Possible matches are suggestions based on bedrooms, areas, types and features. They are not a guarantee, and we don&apos;t decide who is suitable.</li>
            <li><strong className="text-ink">4. Talk privately, then talk to your landlord.</strong> Send a private message through OneShetland. If you both like the idea, speak to your landlords. A mutual exchange needs the written consent of both landlords.</li>
          </ol>
        </Panel>
        <Panel aria-labelledby="safe">
          <h2 id="safe" className="font-display text-2xl font-bold text-ink">Staying safe</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-base text-ink-soft">
            <li>Your advert shows only a broad area (for example &ldquo;Central Mainland&rdquo;), never your address, name or contact details.</li>
            <li>{CONTACT_RULE}</li>
            <li>Take your time. Only share your phone number or address when you feel comfortable.</li>
            <li>Never send money to anyone about a swap. Nobody should ask you to pay to take part.</li>
            <li>Photos: please avoid house numbers, street signs, people and number plates. We remove location data from photos before they are uploaded.</li>
            <li>Don&apos;t include medical details or personal circumstances in your advert. Accessibility features such as &ldquo;ground floor&rdquo; are fine.</li>
            <li>Something doesn&apos;t feel right? Use <strong>Report</strong> on an advert or a conversation, or <strong>Block this member</strong> in a conversation. Our team looks at every report.</li>
          </ul>
        </Panel>
        <Panel aria-labelledby="who">
          <h2 id="who" className="font-display text-2xl font-bold text-ink">What House Swaps is not</h2>
          <p className="mt-2 text-base text-ink-soft">It is a noticeboard, not a matching service. We don&apos;t check whether you are eligible to swap, we don&apos;t approve exchanges, and we don&apos;t act for any landlord. Your landlord has the final say, and Scottish housing rules apply.</p>
        </Panel>
        <div className="flex flex-wrap gap-3">
          <Link href="/house-swaps/my" className={btnPrimary}>Add your advert</Link>
          <Link href="/house-swaps" className={btnSecondary}>Browse the noticeboard</Link>
        </div>
      </div>
    </>
  );
}
