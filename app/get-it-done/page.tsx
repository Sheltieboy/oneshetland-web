import Link from "next/link";
import { getAccount, accountName } from "@/lib/auth";
import { getTradeDemand } from "@/lib/trades-data";
import { TRADE_LABEL } from "@/lib/trades";
import { BriefForm } from "@/components/trades/BriefForm";

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
            room — before you send anything. Free to post, and they ring you directly.
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
            <div className="mt-6 rounded-xl border border-line bg-sand/40 p-5">
              <p className="font-semibold text-ink">Do you do this for a living?</p>
              <p className="mt-1 text-sm text-ink-soft">
                Claim your listing, say what you do and whether you have room, and these jobs
                come to you. Free to receive your first few every month.
              </p>
              <Link href="/for-businesses" className="mt-3 inline-block rounded-pill px-5 py-2.5 text-sm font-bold text-white" style={{ background: ACCENT }}>
                Claim your listing
              </Link>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
