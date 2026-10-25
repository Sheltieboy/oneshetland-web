import { redirect } from "next/navigation";
import { requireMember } from "@/lib/fetch/load.server";
import { fetchApi } from "@/lib/fetch/transport.server";
import { ApplyForm } from "@/components/fetch/v2/Driver";
import { AdultGate } from "@/components/fetch/v2/AdultGate";
import { Notice, PageHead, Shell } from "@/components/fetch/v2/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Apply to drive · Fetch" };

export default async function ApplyPage() {
  await requireMember("/fetch/drive/apply");
  const api = await fetchApi();
  const [v, elig] = await Promise.all([api.verification(), api.eligibility()]);
  if (v.ok && ["pending", "approved", "suspended"].includes(v.data.driver_status)) redirect("/fetch/driver/verification");
  const head = <PageHead title="Apply to drive" back={{ href: "/fetch/drive", label: "Drive with Fetch" }} />;
  if (elig.ok && elig.data.restricted) return <Shell>{head}<Notice tone="warn">Your account can&apos;t use Fetch at the moment. Please contact OneShetland.</Notice></Shell>;
  if (elig.ok && !elig.data.adult_confirmed) return <Shell>{head}<AdultGate /></Shell>;
  const regions = await api.regions();
  return <Shell>{head}<ApplyForm regions={regions.ok ? regions.data : []} /></Shell>;
}
