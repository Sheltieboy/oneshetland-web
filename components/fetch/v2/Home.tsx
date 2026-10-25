import Image from "next/image";
import Link from "next/link";
import type { JobSummary, RequestSummary, Run } from "@/lib/fetch-api";
import { driverStatus, pounds, requesterStatus, sizeLabel, when } from "@/lib/fetch/present";
import { JourneyList } from "@/components/fetch/v2/Driver";
import { FETCH_ACCENT, Panel } from "@/components/fetch/v2/ui";

const LIVE = ["pending", "matched", "collected", "undeliverable"];

export type HomeData = {
  signedIn: boolean; requests: RequestSummary[]; jobs: JobSummary[]; runs: Run[];
  driver: { status: string | null; problem: string | null } | null;
};

/** /fetch — what Fetch is, the two ways in, and (signed in) what is happening now. */
export function FetchHome({ data }: { data: HomeData }) {
  const active = data.requests.filter((r) => LIVE.includes(r.status));
  const live = data.jobs.filter((j) => j.live);
  const driving = data.driver?.status === "approved" || data.driver?.status === "pending";
  return (
    <>
      <section className="relative isolate overflow-hidden" style={{ background: FETCH_ACCENT }}>
        <Image src="/heroes/fetch.jpeg" alt="" fill priority className="object-cover opacity-20" />
        <div className="relative mx-auto max-w-3xl px-4 py-10 sm:px-5 sm:py-12">
          <p className="text-xs font-bold uppercase tracking-widest text-white/80">OneShetland · Fetch</p>
          <h1 className="mt-1 font-display text-4xl font-bold text-white sm:text-5xl">Someone&apos;s going that way</h1>
          <p className="mt-2 max-w-xl text-base text-white/90 sm:text-lg">
            Fetch matches things that need moving with people already travelling across Shetland. You see the price before you post, and you&apos;re only charged once it&apos;s delivered.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-5 sm:py-8">
        <div className="grid gap-3 sm:grid-cols-2">
          <PathCard href="/fetch/new" title="I need something fetched" text="Tell us what, from where and to where. See the price, then post it." />
          <PathCard href={driving ? "/fetch/board" : "/fetch/drive"} title="I'm travelling / I can fetch" text={driving ? "See Fetches that suit your journeys and areas." : "Earn on journeys you're already making. Apply to drive."} />
        </div>

        {data.signedIn && active.length > 0 && (
          <Panel title="Your Fetches" id="mine">
            <ul className="divide-y divide-line">{active.map((r) => (
              <li key={r.id}><Link href={`/fetch/requests/${r.id}`} className="flex flex-wrap items-baseline gap-2 py-2 hover:underline">
                <span className="font-semibold text-ink">{r.route}</span><span className="text-sm text-ink-soft">{r.item_description}</span>
                <span className="ml-auto text-sm font-semibold text-ink">{requesterStatus(r).label}</span></Link></li>
            ))}</ul>
          </Panel>
        )}
        {data.signedIn && live.length > 0 && (
          <Panel title="Jobs you're doing" id="jobs">
            <ul className="divide-y divide-line">{live.map((j) => (
              <li key={j.id}><Link href={`/fetch/jobs/${j.id}`} className="flex flex-wrap items-baseline gap-2 py-2 hover:underline">
                <span className="font-semibold text-ink">{j.route}</span><span className="text-sm text-ink-soft">{j.item_description}</span>
                <span className="ml-auto text-sm font-semibold text-ink">{driverStatus({ status: j.status, payment_status: j.payment_status, cancel_requested_at: j.cancel_requested ? "y" : null }).label}</span></Link></li>
            ))}</ul>
          </Panel>
        )}
        {data.signedIn && driving && <Panel title="Your journeys" id="runs"><JourneyList runs={data.runs.filter((r) => r.status === "open")} /></Panel>}

        <Panel title="How it works">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-soft">
            <li>Post what needs fetching. You see the price first: the driver&apos;s payment, any ferry extra, and OneShetland&apos;s fee.</li>
            <li>A driver who is going that way accepts it. Only then is your card authorised — nothing is taken yet.</li>
            <li>They collect it, bring it, and you&apos;re charged for what actually happened.</li>
          </ol>
        </Panel>
        {data.signedIn && <p className="text-sm"><Link href="/fetch/history" className="font-semibold underline">Your Fetch history</Link></p>}
      </div>
    </>
  );
}

function PathCard({ href, title, text }: { href: string; title: string; text: string }) {
  return (
    <Link href={href} className="block rounded-card border-2 bg-paper p-5 shadow-soft hover:bg-sand/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e0722a]" style={{ borderColor: FETCH_ACCENT }}>
      <p className="font-display text-xl font-bold text-ink">{title} <span aria-hidden>→</span></p>
      <p className="mt-1 text-sm text-ink-soft">{text}</p>
    </Link>
  );
}

/** Past and current Fetches — the safe summary only (no addresses or phone numbers, ever, in history). */
export function History({ requests, jobs }: { requests: RequestSummary[]; jobs: JobSummary[] }) {
  return (
    <div className="space-y-4">
      <Panel title="Fetches you asked for" id="asked">
        {requests.length === 0 ? <p className="text-sm text-ink-muted">None yet.</p> : (
          <ul className="divide-y divide-line">{requests.map((r) => (
            <li key={r.id}><Link href={`/fetch/requests/${r.id}`} className="block py-2 hover:underline">
              <span className="flex flex-wrap items-baseline gap-2"><span className="font-semibold text-ink">{r.route}</span><span className="ml-auto text-sm text-ink">{requesterStatus(r).label}</span></span>
              <span className="block text-sm text-ink-soft">{r.item_description} · {sizeLabel(r.size_class)} · {when(r.created_at)}{r.total_fee_pence ? ` · ${pounds(r.total_fee_pence)}` : ""}</span>
            </Link></li>
          ))}</ul>
        )}
      </Panel>
      <Panel title="Fetches you drove" id="drove">
        {jobs.length === 0 ? <p className="text-sm text-ink-muted">None yet.</p> : (
          <ul className="divide-y divide-line">{jobs.map((j) => (
            <li key={j.id} className="py-2">
              <Link href={`/fetch/jobs/${j.id}`} className="block hover:underline">
                <span className="flex flex-wrap items-baseline gap-2"><span className="font-semibold text-ink">{j.route}</span><span className="ml-auto text-sm text-ink">{driverStatus({ status: j.status }).label}</span></span>
                <span className="block text-sm text-ink-soft">{j.item_description} · {when(j.claimed_at)}{j.driver_pay_pence && ["delivered", "returned"].includes(j.status) ? ` · you earned ${pounds(j.driver_pay_pence)}` : ""}</span>
              </Link>
            </li>
          ))}</ul>
        )}
        <p className="mt-2 text-xs text-ink-muted">A job&apos;s exact addresses are only shown for a short time after it finishes.</p>
      </Panel>
    </div>
  );
}
