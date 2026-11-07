import Link from "next/link";
import { getAccount, accountName } from "@/lib/auth";
import { getTradeDemand } from "@/lib/trades-data";
import { TRADE_LABEL } from "@/lib/trades";
import { BriefForm } from "@/components/trades/BriefForm";
import { FINDER_ANCHOR } from "@/lib/plan-cta";

/**
 * /get-it-done — the demand side.
 *
 * Built first and deliberately: it works with no trades signed up at all,
 * because the output of an unanswered brief is the waiting-list figure, and
 * that figure is what recruits the supply side. 136 services listings on
 * OneShetland have no owner attached; "11 folk are waiting for a plumber" is a
 * far better reason to claim one than anything we could write.
 */

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Get it done — find a tradesperson in Shetland",
  description:
    "Describe the job and we'll show you which trades have room, then send it to them. Free to post.",
};

const ACCENT = "#2a8b5c";

/**
 * How a trade joins. Always shown (it used to appear only when jobs were waiting, which is never true on day one),
 * and every link goes somewhere real.
 */
function TradeJoinPanel() {
  const steps: [string, string][] = [
    ["Claim your listing", "Find your business and claim it. It is free, and we check each claim by hand. Not listed yet? Add your business."],
    ["Say what you do, and whether you have room", "In your business dashboard, open Get it done: job leads. Pick your trades and set your availability. Jobs only reach you while that is up to date."],
    ["Jobs that fit are sent to you", "You get a notification with the job, without the customer's name or number. Tap \"I'm interested\" or say you can't take it."],
    ["The customer decides who gets their details", "If you say you are interested, the customer sees who you are and chooses whether to share their phone number with you. You will not see it until they do."],
  ];
  return (
    <section id="for-trades" className="mt-14 border-t border-line pt-8">
      <h2 className="font-display text-2xl font-bold text-ink">Do you do this for a living?</h2>
      <p className="mt-1 max-w-2xl text-ink-muted">
        Join Get it done and hear about local jobs that match your trade. It is free to join. We can&apos;t promise work, but every job sent to you is from a real person in Shetland.
      </p>
      <ol className="mt-5 grid gap-3 sm:grid-cols-2">
        {steps.map(([t, d], i) => (
          <li key={t} className="rounded-xl border border-line bg-paper p-4 shadow-soft">
            <p className="font-display text-lg font-bold text-ink"><span style={{ color: ACCENT }}>{i + 1}.</span> {t}</p>
            <p className="mt-1 text-sm text-ink-soft">{d}</p>
          </li>
        ))}
      </ol>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link href={FINDER_ANCHOR} className="rounded-pill px-5 py-2.5 text-sm font-bold text-white" style={{ background: ACCENT }}>
          Find and claim your listing
        </Link>
        <Link href="/directory/new" className="rounded-pill border border-line-strong px-5 py-2.5 text-sm font-semibold text-ink-soft hover:bg-sand">
          Not listed? Add your business
        </Link>
        <Link href="/business/leads" className="rounded-pill border border-line-strong px-5 py-2.5 text-sm font-semibold text-ink-soft hover:bg-sand">
          Already claimed? Set up job leads
        </Link>
      </div>
    </section>
  );
}

export default async function GetItDonePage() {
  const [account, demand] = await Promise.all([getAccount(), getTradeDemand()]);
  const waiting = demand.reduce((n, d) => n + d.waiting, 0);

  return (
    <>
      <section className="border-b border-line bg-sand/40">
        <div className="mx-auto max-w-6xl px-5 py-12">
          <p className="eyebrow" style={{ color: ACCENT }}>Get it done</p>
          <h1 className="mt-2 font-display text-4xl font-bold text-navy sm:text-5xl">
            Find somebody to do the job
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-ink-soft">
            Describe what needs doing and we&apos;ll show you which trades actually have
            room — before you send anything. Free to post. A trade tells you it is interested, and you choose who gets your phone number.
          </p>
          {waiting > 0 && (
            <Link href="/get-it-done/waiting" className="mt-4 inline-block text-sm font-semibold" style={{ color: ACCENT }}>
              {waiting} {waiting === 1 ? "job is" : "jobs are"} waiting for a trade across Shetland →
            </Link>
          )}
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-5 py-10">
        <BriefForm
          signedIn={!!account}
          defaultName={account ? accountName(account) : ""}
          defaultEmail={account?.email ?? ""}
        />

        <TradeJoinPanel />

        {demand.length > 0 && (
          <section className="mt-14 border-t border-line pt-8">
            <h2 className="font-display text-2xl font-bold text-ink">What Shetland is waiting for</h2>
            <p className="mt-1 text-ink-muted">
              Open jobs nobody has taken on yet. If you&apos;re a trade, this is work going begging.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {demand.slice(0, 9).map((d) => (
                <div key={d.trade} className="rounded-xl border border-line bg-paper p-4 shadow-soft">
                  <p className="font-display text-lg font-bold text-ink">{TRADE_LABEL[d.trade] ?? d.trade}</p>
                  <p className="mt-1 text-2xl font-black" style={{ color: ACCENT }}>{d.waiting}</p>
                  <p className="text-sm text-ink-muted">
                    waiting{d.unanswered > 0 ? ` · ${d.unanswered} with no answer yet` : ""}
                  </p>
                  {d.avgDaysWaiting > 0 && (
                    <p className="mt-1 text-xs text-ink-faint">Average {d.avgDaysWaiting} days waiting</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
