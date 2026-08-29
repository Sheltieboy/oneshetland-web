import { requireBusinessOwner } from "@/lib/business-server";
import { commercialTermsGate } from "@/lib/commercial-terms.server";
import { getBusinessCode } from "@/lib/business-data.server";
import { CounterMode } from "@/components/business/CounterMode";

export const dynamic = "force-dynamic";
export const metadata = { title: "Counter mode" };

export default async function CounterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusinessOwner(id);
  // One acceptance per business covers every commercial screen. Directory
  // management is deliberately not gated — see lib/commercial-terms.server.
  const gate = await commercialTermsGate(business, "Counter mode");
  if (gate) return gate;
  const code = await getBusinessCode(business.id);
  return <CounterMode businessId={business.id} businessName={business.name} initial={code} />;
}
