import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/fetch/load.server";
import { fetchApi } from "@/lib/fetch/transport.server";
import { fetchMessage } from "@/lib/fetch-api";
import { boardWhen, pounds, sizeLabel } from "@/lib/fetch/present";
import { matchLabel } from "@/components/fetch/v2/Board";
import { AcceptPanel } from "@/components/fetch/v2/AcceptPanel";
import { Notice, PageHead, Panel, RouteLine, Shell } from "@/components/fetch/v2/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "A Fetch" };

/** One Fetch on the board (the notification deep link). The board's own safe view — area only, never the address — plus accept. */
export default async function BoardItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireMember(`/fetch/board/${id}`);
  const api = await fetchApi();
  const [board, runs, elig] = await Promise.all([api.board(true), api.myRuns(), api.eligibility()]);
  const item = board.ok ? board.data.find((i) => i.request_id === id) : undefined;
  if (!item) {
    const mine = await api.detail(id);
    if (mine.ok && mine.data.viewer === "driver") redirect(`/fetch/jobs/${id}`);
    return <Shell><PageHead title="This Fetch has gone" back={{ href: "/fetch/board", label: "Fetches" }} /><Notice>It has been accepted by someone else, cancelled, or is no longer open. <Link href="/fetch/board" className="font-semibold underline">See other Fetches</Link></Notice></Shell>;
  }
  const m = matchLabel(item, runs.ok ? runs.data : []);
  const problem = elig.ok && elig.data.driver_problem ? fetchMessage(elig.data.driver_problem) : null;
  return (
    <Shell>
      <PageHead kicker={m ?? "Fetch"} title={item.item_description} back={{ href: "/fetch/board", label: "Fetches" }} />
      <div className="space-y-4">
        <Panel>
          <RouteLine from={`${item.pickup_area ? `${item.pickup_area}, ` : ""}${item.pickup_region}`} to={`${item.destination_area ? `${item.destination_area}, ` : ""}${item.destination_region}`} ferry={item.ferry_required} />
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-ink-muted">You&apos;re paid</dt><dd className="font-display text-xl font-bold text-ink">{pounds(item.driver_pay_pence)}</dd></div>
            <div><dt className="text-ink-muted">When</dt><dd className="text-ink">{boardWhen(item)}</dd></div>
            <div><dt className="text-ink-muted">Size</dt><dd className="text-ink">{sizeLabel(item.size_class)}{item.approx_dimensions_cm ? ` · about ${item.approx_dimensions_cm.l}×${item.approx_dimensions_cm.w}×${item.approx_dimensions_cm.h} cm` : ""}</dd></div>
            <div><dt className="text-ink-muted">Handling</dt><dd className="text-ink">{[item.handling_flags.includes("heavy_two_person") && "Two-person lift", item.handling_flags.includes("fragile") && "Fragile"].filter(Boolean).join(" · ") || "Nothing special"}</dd></div>
          </dl>
          {item.match_summary && <p className="mt-2 text-sm text-ink-soft">{item.match_summary}</p>}
        </Panel>
        {problem && <Notice tone="warn">{problem} <Link href="/fetch/driver/verification" className="font-semibold underline">Your driver details</Link></Notice>}
        {item.match === "beyond_vehicle" && <Notice tone="warn">This is larger than your vehicle takes.</Notice>}
        <Panel title="Accept">
          <AcceptPanel id={id} needsFit={item.size_class === "large" || item.size_class === "bulky"} canClaim={item.can_claim} photoIds={item.matching_photo_ids} />
        </Panel>
      </div>
    </Shell>
  );
}
