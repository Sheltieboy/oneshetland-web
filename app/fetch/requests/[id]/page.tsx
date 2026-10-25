import { notFound, redirect } from "next/navigation";
import { loadJob, requireMember } from "@/lib/fetch/load.server";
import { RequesterJob } from "@/components/fetch/v2/RequesterJob";
import { LiveRefresh } from "@/components/fetch/v2/LiveRefresh";
import { PageHead, Shell } from "@/components/fetch/v2/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your Fetch" };

export default async function RequestPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ posted?: string }> }) {
  const { id } = await params;
  await requireMember(`/fetch/requests/${id}`);
  const job = await loadJob(id);
  if (!job) notFound();
  if (job.viewer === "driver") redirect(`/fetch/jobs/${id}`);
  const { posted } = await searchParams;
  return (
    <Shell>
      <PageHead title="Your Fetch" back={{ href: "/fetch", label: "Fetch" }} />
      <RequesterJob data={{ ...job.data, posted: posted === "1" }} />
      <LiveRefresh />
    </Shell>
  );
}
