import Link from "next/link";
import { requireBusinessOwner } from "@/lib/business-server";
import { commercialTermsGate } from "@/lib/commercial-terms.server";
import { getLoyaltyProgram, getBusinessCode } from "@/lib/business-data.server";
import { getEffectiveTier } from "@/lib/entitlement.server";
import { CapabilityPaywall } from "@/components/business/CapabilityPaywall";
import { LoyaltyManager } from "@/components/business/LoyaltyManager";
import { LoyaltyTill } from "@/components/business/LoyaltyTill";
import { TillCode } from "@/components/business/TillCode";
import { RedeemVerify } from "@/components/business/RedeemVerify";
import { BIZ } from "@/lib/business-data";
import { HelpTip } from "@/components/help/HelpTip";

export const dynamic = "force-dynamic";
export const metadata = { title: "Loyalty programme" };

export default async function LoyaltyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusinessOwner(id);
  // One acceptance per business covers every commercial screen. Directory
  // management is deliberately not gated — see lib/commercial-terms.server.
  const gate = await commercialTermsGate(business, "Loyalty");
  if (gate) return gate;
  const { pro } = await getEffectiveTier(business.id);
  const base = `/business/${business.id}/manage`;
  const [program, code] = await Promise.all([
    getLoyaltyProgram(business.id),
    getBusinessCode(business.id),
  ]);
  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Link href={`/business/${business.id}/manage`} className="text-sm font-semibold text-ink-soft hover:text-ink">← {business.name}</Link>
      <h1 className="mt-3 mb-2 flex items-center gap-2.5 font-display text-3xl font-bold sm:text-4xl">
        Loyalty programme
        <HelpTip topic="loyalty-stamps" />
      </h1>
      <p className="mb-6 text-ink-soft">Reward regulars with stamps or points.</p>
      {pro ? (
        <LoyaltyManager businessId={business.id} program={program} canConfigure />
      ) : (
        <CapabilityPaywall
          capability="Loyalty"
          plan="Pro"
          what="A stamp or points card customers collect on their phone, so there is a reason to come back."
          gets={[
            "Stamps or points, with rewards you choose",
            "Customers collect at the counter or by tapping a tile",
            "Their card lives in the app — no bits of cardboard",
          ]}
          billingHref={`${base}/billing`}
          backHref={base}
          backLabel={`Back to ${business.name}`}
        >
          {program && (
            <section>
              <h2 className="eyebrow mb-2 text-ink-muted">Your programme</h2>
              <LoyaltyManager businessId={business.id} program={program} canConfigure={false} />
            </section>
          )}
        </CapabilityPaywall>
      )}

      {/* The one-card till — scan/enter the customer's member code and act. */}
      <div className="mt-8">
        <LoyaltyTill businessId={business.id} accent={BIZ} />
      </div>

      {/* Stamp a customer — they read this rotating code and enter it in their app
          to collect a stamp / redeem a reward. Mirrors the app's stamp scanner
          (local-stamp-scanner.tsx → local-stamp-collect), which is code-entry, not
          a camera scan: the merchant displays the code, the customer enters it. */}
      <div className="mt-8">
        <h2 className="mb-2 font-display text-xl font-bold">Stamp a customer</h2>
        <p className="mb-3 text-sm text-ink-soft">
          Show this code at the till. Customers enter it in the OneShetland app to collect a stamp.
        </p>
        <TillCode businessId={business.id} initial={code} />
      </div>

      {/* Confirm a redemption — staff enter the customer's code to redeem an
          offer, stamp reward or pass (the staff-verified backbone). */}
      <div className="mt-8">
        <RedeemVerify accent={BIZ} />
      </div>
    </div>
  );
}
