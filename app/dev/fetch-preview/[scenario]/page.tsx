import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORIES, MESSAGES, REGIONS, previewNow, scenarios, type Screen } from "@/lib/fetch/scenarios";
import { RequestWizard } from "@/components/fetch/v2/RequestWizard";
import { RequesterJob } from "@/components/fetch/v2/RequesterJob";
import { DriverJob } from "@/components/fetch/v2/DriverJob";
import { BoardList, matchLabel } from "@/components/fetch/v2/Board";
import { AcceptPanel } from "@/components/fetch/v2/AcceptPanel";
import { VerificationView } from "@/components/fetch/v2/Driver";
import { FetchHome } from "@/components/fetch/v2/Home";
import { Notice, PageHead, Panel, RouteLine, Shell } from "@/components/fetch/v2/ui";

/**
 * DEV-ONLY fixture preview of the Fetch v2 member screens (Step 11). Renders the real view components from lib/fetch/scenarios.ts —
 * no backend, no session, nothing sent. It exists only when NODE_ENV is not production AND FETCH_PREVIEW=1; otherwise it is a 404.
 * Lives outside /fetch so the Fetch flag gate is not involved and no real Fetch route is weakened.
 */
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function FetchPreview({ params }: { params: Promise<{ scenario: string }> }) {
  if (process.env.NODE_ENV === "production" || process.env.FETCH_PREVIEW !== "1") notFound();
  const { scenario } = await params;
  const now = previewNow();
  const all = scenarios(now);
  const s = all.find((x) => x.key === scenario);
  if (!s) notFound();
  return (
    <div>
      <nav aria-label="Preview scenarios" className="border-b border-line bg-amber-50 px-4 py-2 text-xs">
        <b>Fixture preview — not live data.</b>{" "}
        {all.map((x) => <Link key={x.key} href={`/dev/fetch-preview/${x.key}`} className={`mr-2 underline ${x.key === s.key ? "font-bold" : ""}`}>{x.key.toUpperCase()}</Link>)}
      </nav>
      <p className="mx-auto max-w-3xl px-4 pt-4 text-sm font-bold text-ink">{s.name}</p>
      {s.screens.map((screen, i) => <div key={i} className="border-b-4 border-dashed border-line">{render(screen, now)}</div>)}
    </div>
  );
}

function render(sc: Screen, now: number) {
  const tag = <p className="text-xs font-bold uppercase text-ink-muted">Screen: {sc.title}</p>;
  switch (sc.kind) {
    case "wizard": return <Shell>{tag}<PageHead title="Ask for a Fetch" back={{ href: "/fetch", label: "Fetch" }} /><RequestWizard regions={REGIONS} categories={CATEGORIES} initial={{ draft: sc.draft, step: sc.step, quote: sc.quote }} /></Shell>;
    case "requester": return <Shell>{tag}<PageHead title="Your Fetch" back={{ href: "/fetch", label: "Fetch" }} /><RequesterJob data={{ detail: sc.detail, timeline: sc.timeline, photos: sc.photos, issues: [], hint: sc.hint ?? null, now,
      messages: sc.messages ? { can_send: true, messages: [] } : null }} /></Shell>;
    case "driver": return <Shell>{tag}<PageHead kicker="Fetch · your job" title={String(sc.detail.request.item_description)} back={{ href: "/fetch/drive", label: "Drive with Fetch" }} />
      <DriverJob data={{ detail: sc.detail, timeline: sc.timeline, photos: sc.photos, issues: [], pay: sc.pay, driverProblem: sc.driverProblem ?? null, now, messages: { can_send: true, messages: MESSAGES(now) } }} /></Shell>;
    case "board": return <Shell>{tag}<PageHead title="Fetches" sub="Things that need moving. The ones that fit your journeys come first." /><BoardList items={sc.items} runs={sc.runs} showAll={sc.showAll} problem={sc.problem} /></Shell>;
    case "boardItem":
      if (!sc.item) return <Shell>{tag}<PageHead title="This Fetch has gone" back={{ href: "/fetch/board", label: "Fetches" }} /><Notice tone="warn">{sc.gone}</Notice>
        <div className="mt-3"><Notice>It has been accepted by someone else, cancelled, or is no longer open. <Link href="/fetch/board" className="font-semibold underline">See other Fetches</Link></Notice></div></Shell>;
      return <Shell>{tag}<PageHead kicker={matchLabel(sc.item, sc.runs) ?? "Fetch"} title={sc.item.item_description} back={{ href: "/fetch/board", label: "Fetches" }} />
        <div className="space-y-4"><Panel><RouteLine from={`${sc.item.pickup_area}, ${sc.item.pickup_region}`} to={`${sc.item.destination_area}, ${sc.item.destination_region}`} ferry={sc.item.ferry_required} />
          <p className="mt-2 text-sm text-ink-soft">{sc.item.match_summary}</p></Panel>
        <Panel title="Accept"><AcceptPanel id={sc.item.request_id} needsFit canClaim={sc.item.can_claim} photoIds={sc.item.matching_photo_ids} /></Panel></div></Shell>;
    case "verification": return <Shell>{tag}<PageHead title="Your driver details" /><VerificationView v={sc.v} /></Shell>;
    case "home": return <div>{tag}<FetchHome data={{ signedIn: true, requests: sc.requests, jobs: sc.jobs, runs: sc.runs, driver: { status: "approved", problem: null } }} /></div>;
  }
}
