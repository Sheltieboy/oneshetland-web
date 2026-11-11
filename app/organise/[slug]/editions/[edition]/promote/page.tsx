import { can } from "@/lib/editions/rules";
import { activeUntil } from "@/lib/editions/journey";
import { getCatalogue, getCommerceEnabled, getPromoAvailability, getPromoRights, getPromoSettings } from "@/lib/editions/commerce.server";
import { bookingWindow, londonDay, londonToday, type AvailRow } from "@/lib/editions/promo";
import { EditionHeader } from "@/components/editions-manage/EditionHeader";
import { PromoManager } from "@/components/editions-manage/PromoManager";
import { Panel } from "@/components/editions-manage/kit";
import { editionPage } from "../../../../gate";

export const dynamic = "force-dynamic";
export const metadata = { title: "Promote your Edition" };

export default async function PromotePage({ params }: { params: Promise<{ slug: string; edition: string }> }) {
  const { slug, edition: edSlug } = await params;
  const { organiser, role, bundle } = await editionPage(slug, edSlug, `/organise/${slug}/editions/${edSlug}/promote`);
  const { edition } = bundle;
  const [{ promotions }, commerceOn, settings, rights] = await Promise.all([getCatalogue(organiser.id), getCommerceEnabled(), getPromoSettings(), getPromoRights(edition.id)]);
  const today = londonToday();
  const until = bundle.entitled ? activeUntil(bundle.entitlements) : null;
  const approved = edition.review_state === "approved";
  const published = edition.status === "published";
  const publishedOn = edition.published_at ? londonDay(edition.published_at) : null;

  const scheduleBlock = !approved ? "Promotion can start once OneShetland has approved your Edition."
    : !published ? "Publish your Edition first. Promotion can only start once it is live."
    : !until ? "Your Edition needs an active package before it can be promoted."
    : null;
  const buyBlock = !approved ? "You can add promotion once OneShetland has approved your Edition."
    : !until ? "Choose a package for your Edition first, then you can add promotion."
    : null;

  // One availability read per kind over the whole window in which anything could start; the picker works from that, so choosing dates needs no further round trips.
  let availability: Record<"discovery" | "homepage", AvailRow[]> = { discovery: [], homepage: [] };
  if (!scheduleBlock) {
    const win = bookingWindow({ today, leadDays: settings.leadDays, horizonDays: settings.horizonDays, publishedOn, entitlementEnd: until, days: 1 });
    if (win) {
      const [discovery, homepage] = await Promise.all([getPromoAvailability("discovery", win.earliest, win.lastDay), getPromoAvailability("homepage", win.earliest, win.lastDay)]);
      availability = { discovery, homepage };
    }
  }
  const hasBookings = rights.some((r) => r.status === "booked" || r.status === "used");
  return (
    <>
      <EditionHeader organiser={organiser} edition={edition} active="promote" />
      <Panel title="Promote your Edition" sub="Choose when your Edition is featured. Optional, and never needed to run it.">
        <PromoManager organiserSlug={slug} editionSlug={edition.slug} editionTitle={edition.title} canAct={can(role, "admin")} scheduleBlock={scheduleBlock} buyBlock={buyBlock}
          rights={rights} settings={settings} today={today} publishedOn={publishedOn} entitlementEnd={until} availability={availability} promotions={promotions} commerceOn={commerceOn} hasBookings={hasBookings} />
      </Panel>
    </>
  );
}
