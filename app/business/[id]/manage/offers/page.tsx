import Link from "next/link";
import { requireBusinessOwner } from "@/lib/business-server";
import { commercialTermsGate } from "@/lib/commercial-terms.server";
import { getBusinessOffers } from "@/lib/business-data.server";
import { getEffectiveTier } from "@/lib/entitlement.server";
import { CapabilityPaywall } from "@/components/business/CapabilityPaywall";
import { OffersManager } from "@/components/business/OffersManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Offers" };

export default async function OffersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusinessOwner(id);
  // One acceptance per business covers every commercial screen. Directory
  // management is deliberately not gated — see lib/commercial-terms.server.
  const gate = await commercialTermsGate(business, "Offers");
  if (gate) return gate;
  const { pro } = await getEffectiveTier(business.id);
  const offers = await getBusinessOffers(business.id, true);
  const base = `/business/${business.id}/manage`;
  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Link href={`/business/${business.id}/manage`} className="text-sm font-semibold text-ink-soft hover:text-ink">← {business.name}</Link>
      <h1 className="mt-3 mb-6 font-display text-3xl font-bold sm:text-4xl">Offers</h1>
      {/* Offers are gated before setup — the server refuses the insert — so an
          explanation replaces the manager rather than a redirect replacing the
          page. Anything already running is still listed below it, because
          withdrawal never needs a plan and nobody should be stuck advertising
          something they cannot end. */}
      {pro ? (
        <OffersManager businessId={business.id} offers={offers} canConfigure />
      ) : (
        <CapabilityPaywall
          capability="Offers"
          plan="Pro"
          what="Time-limited deals that show on your listing and across Local, for folk who have already found you."
          gets={[
            "Create an offer with your own dates and terms",
            "It appears on your listing and in the Local feed",
            "See how many times each one was claimed",
          ]}
          billingHref={`${base}/billing`}
          backHref={base}
          backLabel={`Back to ${business.name}`}
        >
          {offers.length > 0 && (
            <section>
              <h2 className="eyebrow mb-2 text-ink-muted">Your offers</h2>
              <OffersManager businessId={business.id} offers={offers} canConfigure={false} />
            </section>
          )}
        </CapabilityPaywall>
      )}
    </div>
  );
}
