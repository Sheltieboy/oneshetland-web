import { requireMember } from "@/lib/fetch/load.server";
import { fetchApi } from "@/lib/fetch/transport.server";
import { History } from "@/components/fetch/v2/Home";
import { PageHead, Shell } from "@/components/fetch/v2/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your Fetch history" };

export default async function HistoryPage() {
  await requireMember("/fetch/history");
  const api = await fetchApi();
  const [req, jobs] = await Promise.all([api.myRequests(), api.myJobs()]);
  return (
    <Shell>
      <PageHead title="Your Fetch history" back={{ href: "/fetch", label: "Fetch" }} />
      <History requests={req.ok ? req.data : []} jobs={jobs.ok ? jobs.data : []} />
    </Shell>
  );
}
