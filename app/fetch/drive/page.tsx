import Link from "next/link";
import { requireMember } from "@/lib/fetch/load.server";
import { fetchApi } from "@/lib/fetch/transport.server";
import { JourneyList } from "@/components/fetch/v2/Driver";
import { FETCH_ACCENT, Notice, PageHead, Panel, Shell, btnPrimary, btnSecondary } from "@/components/fetch/v2/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Drive with Fetch" };

export default async function DrivePage() {
  await requireMember("/fetch/drive");
  const api = await fetchApi();
  const [v, runs] = await Promise.all([api.verification(), api.myRuns()]);
  const status = v.ok ? v.data.driver_status : null;
  const applied = status === "pending" || status === "approved" || status === "suspended" || status === "rejected";
  return (
    <Shell>
      <PageHead title="Drive with Fetch" sub="Take things where you're already going, and get paid for it." back={{ href: "/fetch", label: "Fetch" }} />
      <div className="space-y-4">
        {!applied ? (
          <Panel title="How driving works">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-soft">
              <li>Apply with your vehicle, then upload your driving licence and insurance. OneShetland checks them.</li>
              <li>Tell us where you&apos;re travelling. Fetches that fit your journey are shown first.</li>
              <li>Accept one, collect it once the payment is confirmed, deliver it. You&apos;re paid to your bank account.</li>
            </ol>
            <p className="mt-2 text-sm text-ink-soft">You&apos;ll need payouts set up in <Link href="/account/payments" className="font-semibold underline">your payments</Link> before you accept a Fetch.</p>
            <Link href="/fetch/drive/apply" className={`${btnPrimary} mt-3`} style={{ background: FETCH_ACCENT }}>Apply to drive</Link>
          </Panel>
        ) : (
          <>
            {status === "pending" && <Notice>Your application is under review. <Link href="/fetch/driver/verification" className="font-semibold underline">Check your documents</Link></Notice>}
            {v.ok && status === "approved" && !v.data.can_claim && <Notice tone="warn">You can&apos;t accept Fetches right now. <Link href="/fetch/driver/verification" className="font-semibold underline">See why</Link></Notice>}
            <div className="flex flex-wrap gap-2">
              <Link href="/fetch/board" className={btnPrimary} style={{ background: FETCH_ACCENT }}>See Fetches</Link>
              <Link href="/fetch/journeys/new" className={btnSecondary}>Post a journey</Link>
              <Link href="/fetch/driver/verification" className={btnSecondary}>My driver details</Link>
            </div>
            <Panel title="Your journeys"><JourneyList runs={runs.ok ? runs.data : []} /></Panel>
            <p className="text-sm text-ink-soft">Earnings are paid to the bank account in <Link href="/account/payments" className="font-semibold underline">your payments</Link>.</p>
          </>
        )}
      </div>
    </Shell>
  );
}
