import { getAccount } from "@/lib/auth";
import { fetchApi } from "@/lib/fetch/transport.server";
import { FetchHome, type HomeData } from "@/components/fetch/v2/Home";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fetch · Someone's going that way" };

export default async function FetchPage() {
  const account = await getAccount();
  const data: HomeData = { signedIn: !!account, requests: [], jobs: [], runs: [], driver: null };
  if (account) {
    const api = await fetchApi();
    const [req, jobs, runs, elig] = await Promise.all([api.myRequests(), api.myJobs(), api.myRuns(), api.eligibility()]);
    data.requests = req.ok ? req.data : [];
    data.jobs = jobs.ok ? jobs.data : [];
    data.runs = runs.ok ? runs.data : [];
    const v = await api.verification();
    data.driver = { status: v.ok ? v.data.driver_status : null, problem: elig.ok ? elig.data.driver_problem : null };
  }
  return <FetchHome data={data} />;
}
