import Link from "next/link";
import { requireMember } from "@/lib/fetch/load.server";
import { fetchApi } from "@/lib/fetch/transport.server";
import { RequestWizard } from "@/components/fetch/v2/RequestWizard";
import { AdultGate } from "@/components/fetch/v2/AdultGate";
import { Notice, PageHead, Shell } from "@/components/fetch/v2/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ask for a Fetch" };

export default async function NewFetchPage() {
  await requireMember("/fetch/new");
  const api = await fetchApi();
  const elig = await api.eligibility();
  const head = <PageHead title="Ask for a Fetch" sub="What needs moving, from where, to where, and when." back={{ href: "/fetch", label: "Fetch" }} />;
  if (!elig.ok) return <Shell>{head}<Notice tone="error">{elig.message}</Notice></Shell>;
  if (elig.data.restricted) return <Shell>{head}<Notice tone="warn">Your account can&apos;t post Fetches at the moment. Please <Link href="/support" className="font-semibold underline">contact OneShetland</Link>.</Notice></Shell>;
  if (!elig.data.adult_confirmed) return <Shell>{head}<AdultGate /></Shell>;
  const [regions, categories] = await Promise.all([api.regions(), api.categories()]);
  return <Shell>{head}<RequestWizard regions={regions.ok ? regions.data : []} categories={categories.ok ? categories.data : []} /></Shell>;
}
