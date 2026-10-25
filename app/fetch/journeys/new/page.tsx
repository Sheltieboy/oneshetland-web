import { requireMember } from "@/lib/fetch/load.server";
import { fetchApi } from "@/lib/fetch/transport.server";
import { JourneyForm } from "@/components/fetch/v2/Driver";
import { PageHead, Shell } from "@/components/fetch/v2/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Post a journey · Fetch" };

export default async function NewJourneyPage() {
  await requireMember("/fetch/journeys/new");
  const api = await fetchApi();
  const [regions, categories] = await Promise.all([api.regions(), api.categories()]);
  return (
    <Shell>
      <PageHead title="Where are you going?" sub="Fetches that fit your journey are shown to you first." back={{ href: "/fetch/drive", label: "Drive with Fetch" }} />
      <JourneyForm regions={regions.ok ? regions.data : []} categories={categories.ok ? categories.data : []} />
    </Shell>
  );
}
