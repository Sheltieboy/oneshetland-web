import { notFound, redirect } from "next/navigation";
import { loadJob, requireMember } from "@/lib/fetch/load.server";
import { PaymentConfirm } from "@/components/fetch/v2/JobParts";
import { Notice, PageHead, Shell } from "@/components/fetch/v2/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Confirm your payment · Fetch" };

/** The notification deep link for "your bank needs you to confirm". Anything other than a payment needing the requester goes to the Fetch. */
export default async function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireMember(`/fetch/requests/${id}/payment`);
  const job = await loadJob(id);
  if (!job || job.viewer !== "requester") notFound();
  const r = job.data.detail.request;
  if (r.status !== "matched" || !["requires_action", "requires_payment_method"].includes(r.payment_status)) redirect(`/fetch/requests/${id}`);
  return (
    <Shell>
      <PageHead title="Confirm your payment" back={{ href: `/fetch/requests/${id}`, label: "Your Fetch" }} />
      <div className="space-y-4">
        <Notice>A driver has accepted your Fetch. The amount is only reserved now; you&apos;re charged when it&apos;s delivered.</Notice>
        <PaymentConfirm requestId={id} paymentStatus={r.payment_status} />
      </div>
    </Shell>
  );
}
