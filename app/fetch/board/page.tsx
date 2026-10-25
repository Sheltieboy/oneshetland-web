import { requireMember } from "@/lib/fetch/load.server";
import { fetchApi } from "@/lib/fetch/transport.server";
import { fetchMessage } from "@/lib/fetch-api";
import { BoardList } from "@/components/fetch/v2/Board";
import { LiveRefresh } from "@/components/fetch/v2/LiveRefresh";
import { Notice, PageHead, Shell } from "@/components/fetch/v2/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fetches near you" };

export default async function BoardPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  await requireMember("/fetch/board");
  const showAll = (await searchParams).all === "1";
  const api = await fetchApi();
  const [board, runs, elig] = await Promise.all([api.board(showAll), api.myRuns(), api.eligibility()]);
  return (
    <Shell>
      <PageHead title="Fetches" sub="Things that need moving. The ones that fit your journeys come first." back={{ href: "/fetch/drive", label: "Drive with Fetch" }} />
      {!board.ok ? <Notice tone="error">{board.message}</Notice>
        : <BoardList items={board.data} runs={runs.ok ? runs.data : []} showAll={showAll} problem={elig.ok && elig.data.driver_problem ? fetchMessage(elig.data.driver_problem) : null} />}
      <LiveRefresh />
    </Shell>
  );
}
