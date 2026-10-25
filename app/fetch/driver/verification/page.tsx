import Link from "next/link";
import { requireMember } from "@/lib/fetch/load.server";
import { fetchApi } from "@/lib/fetch/transport.server";
import { VerificationView } from "@/components/fetch/v2/Driver";
import { Notice, PageHead, Shell } from "@/components/fetch/v2/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your driver details · Fetch" };

export default async function VerificationPage({ searchParams }: { searchParams: Promise<{ applied?: string }> }) {
  await requireMember("/fetch/driver/verification");
  const v = await (await fetchApi()).verification();
  const { applied } = await searchParams;
  return (
    <Shell>
      <PageHead title="Your driver details" back={{ href: "/fetch/drive", label: "Drive with Fetch" }} />
      {!v.ok ? <Notice tone="error">{v.message}</Notice>
        : v.data.driver_status === "not_applied" ? <Notice>You haven&apos;t applied to drive yet. <Link href="/fetch/drive/apply" className="font-semibold underline">Apply to drive</Link></Notice>
        : <VerificationView v={v.data} applied={applied === "1"} />}
    </Shell>
  );
}
