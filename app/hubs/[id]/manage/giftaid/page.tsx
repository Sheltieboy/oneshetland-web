import Link from "next/link";
import { redirect } from "next/navigation";
import { requireHubAdmin, getHubDonations } from "@/lib/hubs-server";
import { GiftAidExport } from "@/components/hubs/admin/GiftAidExport";

export const dynamic = "force-dynamic";
export const metadata = { title: "Gift Aid" };

export default async function GiftAidPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { hub, accent } = await requireHubAdmin(id);
  if (!hub.is_charity) redirect(`/hubs/${hub.slug || hub.id}/manage`);

  const donations = await getHubDonations(hub.id, true);

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:py-12">
      <Link href={`/hubs/${hub.slug || hub.id}/manage`} className="text-sm font-semibold hover:underline" style={{ color: accent }}>← Back to management</Link>
      <h1 className="mt-3 font-display text-3xl font-bold">Gift Aid</h1>
      <p className="mt-1 text-ink-soft">Export your donors&apos; Gift Aid declarations to submit a claim to HMRC.</p>
      <div className="mt-8"><GiftAidExport donations={donations} hubName={hub.name} /></div>
    </div>
  );
}
