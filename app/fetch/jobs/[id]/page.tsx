import { notFound, redirect } from "next/navigation";
import { loadJob, requireMember } from "@/lib/fetch/load.server";
import { DriverJob } from "@/components/fetch/v2/DriverJob";
import { LiveRefresh } from "@/components/fetch/v2/LiveRefresh";
import { PageHead, Shell } from "@/components/fetch/v2/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your Fetch job" };

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireMember(`/fetch/jobs/${id}`);
  const job = await loadJob(id);
  if (!job) notFound();
  if (job.viewer === "requester") redirect(`/fetch/requests/${id}`);
  return (
    <Shell>
      <PageHead kicker="Fetch · your job" title={job.data.detail.request.item_description} back={{ href: "/fetch/drive", label: "Drive with Fetch" }} />
      <DriverJob data={job.data} />
      <LiveRefresh />
    </Shell>
  );
}
