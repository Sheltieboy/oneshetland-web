import Image from "next/image";
import Link from "next/link";
import { getAccount } from "@/lib/auth";
import {
  FETCH, getCategoryName, getCategoryIcon, penceToGBP, runDestination,
  type Run,
} from "@/lib/fetch-data";
import {
  getDriverProfile, isApprovedDriver, isBankConnected,
  getMyActiveRequests, getMyRuns, getOpenRequestsForDrivers, getMyActiveDeliveries,
} from "@/lib/fetch-data.server";
import {
  RequestCard, RunCard, RouteBlock, EmptyState, QuickLink, DriverStatusPill,
} from "@/components/fetch/FetchUI";
import { AcceptRequestButton } from "@/components/fetch/AcceptRequestButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fetch · Community delivery · OneShetland" };

export default async function FetchHub({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const isDriver = tab === "driver";
  const account = await getAccount();

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden" style={{ background: FETCH }}>
        <Image src="/heroes/fetch.jpeg" alt="" fill priority className="object-cover opacity-20" />
        <div className="absolute inset-0" style={{ background: `linear-gradient(160deg,${FETCH}e6 30%,${FETCH}b0)` }} />
        <div className="relative mx-auto max-w-6xl px-5 py-10 sm:py-12">
          <p className="text-xs font-bold uppercase tracking-widest text-white/75">OneShetland · Fetch</p>
          <h1 className="mt-1 font-display text-4xl font-bold text-white sm:text-5xl">Community delivery</h1>
          <p className="mt-2 max-w-xl text-base text-white/85 sm:text-lg">
            {isDriver
              ? "Heading somewhere anyway? Pick up deliveries along your route and earn for each one."
              : "Get things brought to your door — takeaways, prescriptions, parcels and shop collections, the island way."}
          </p>
          <div className="mt-5 inline-flex gap-1 rounded-pill bg-white/15 p-1 backdrop-blur-sm">
            <Link href="/fetch" className={"rounded-pill px-5 py-2 text-sm font-bold transition " + (!isDriver ? "bg-white" : "text-white/80 hover:text-white")} style={!isDriver ? { color: FETCH } : undefined}>Request</Link>
            <Link href="/fetch?tab=driver" className={"rounded-pill px-5 py-2 text-sm font-bold transition " + (isDriver ? "bg-white" : "text-white/80 hover:text-white")} style={isDriver ? { color: FETCH } : undefined}>Drive</Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 py-10 sm:py-12">
        {!account ? (
          <SignedOut isDriver={isDriver} />
        ) : isDriver ? (
          <DriverView userId={account.id} />
        ) : (
          <RequesterView userId={account.id} />
        )}
      </div>
    </>
  );
}

function SignedOut({ isDriver }: { isDriver: boolean }) {
  return (
    <div className="rounded-card border px-6 py-10 text-center" style={{ borderColor: `${FETCH}40`, background: `${FETCH}0d` }}>
      <p className="font-display text-2xl font-bold text-ink">{isDriver ? "Drive with Fetch" : "Sign in to request a delivery"}</p>
      <p className="mx-auto mt-2 max-w-lg text-ink-soft">
        {isDriver
          ? "Approved drivers create runs and pick up deliveries along the way. Sign in to apply."
          : "Tell us what you need brought, and a local driver heading your way will bring it. Your card is only charged on delivery."}
      </p>
      <Link href={`/sign-in?next=${encodeURIComponent(isDriver ? "/fetch?tab=driver" : "/fetch")}`} className="mt-5 inline-block rounded-pill px-6 py-3 font-semibold text-white shadow-soft" style={{ background: FETCH }}>Sign in →</Link>
    </div>
  );
}

/* ── Requester ────────────────────────────────────────────────────────────── */

async function RequesterView({ userId }: { userId: string }) {
  const [active, driverProfile] = await Promise.all([getMyActiveRequests(userId), getDriverProfile(userId)]);
  const isDriver = isApprovedDriver(driverProfile);
  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-3">
        <QuickLink href="/fetch/new" icon="➕" label="Request a delivery" primary />
        <QuickLink href="/fetch/previous" icon="📋" label="Previous deliveries" />
        <QuickLink href={isDriver ? "/fetch?tab=driver" : "/fetch/apply"} icon="🚗" label={isDriver ? "Driver dashboard" : "Become a driver"} />
      </div>

      <section>
        <h2 className="mb-3 font-display text-2xl font-bold text-ink">Your active deliveries</h2>
        {active.length === 0 ? (
          <EmptyState icon="🛵" title="Nothing on its way" body="When you request a delivery it'll appear here so you can track it live." cta={{ label: "Request a delivery", href: "/fetch/new" }} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((r) => <RequestCard key={r.id} req={r} href={`/fetch/${r.id}`} />)}
          </div>
        )}
      </section>

      <div className="rounded-card border px-6 py-8 text-center" style={{ borderColor: `${FETCH}40`, background: `${FETCH}0d` }}>
        <p className="font-display text-2xl font-bold text-ink">Need something brought over?</p>
        <p className="mx-auto mt-2 max-w-lg text-ink-soft">Pick it up from any Lerwick shop, takeaway or pharmacy and have it delivered along a driver&apos;s route.</p>
        <Link href="/fetch/new" className="mt-5 inline-block rounded-pill px-6 py-3 font-semibold text-white shadow-soft transition hover:brightness-95" style={{ background: FETCH }}>Request a delivery →</Link>
      </div>
    </div>
  );
}

/* ── Driver ───────────────────────────────────────────────────────────────── */

async function DriverView({ userId }: { userId: string }) {
  const driverProfile = await getDriverProfile(userId);
  const approved = isApprovedDriver(driverProfile);
  const bankOk = isBankConnected(driverProfile);
  const status = driverProfile?.driver_status ?? "not_applied";

  const [runs, open, activeDeliveries] = approved
    ? await Promise.all([getMyRuns(userId), getOpenRequestsForDrivers(), getMyActiveDeliveries(userId)])
    : [[] as Run[], [] as Awaited<ReturnType<typeof getOpenRequestsForDrivers>>, [] as Awaited<ReturnType<typeof getMyActiveDeliveries>>];

  const openRuns = runs.filter((r) => r.status === "open").map((r) => ({ id: r.id, notes: r.notes, destination_area: r.destination_area, departure_start: r.departure_start }));
  const canAccept = approved && bankOk;

  return (
    <div className="space-y-8">
      {/* Status strip */}
      <div className="flex items-center justify-between rounded-card border border-line bg-paper px-5 py-3 shadow-soft">
        <span className="text-sm font-semibold text-ink-soft">Driver status</span>
        <DriverStatusPill status={status} />
      </div>

      {/* Not approved → application states */}
      {!approved && (
        <div className="rounded-card border border-line bg-paper p-5 shadow-soft">
          {status === "not_applied" ? (
            <>
              <p className="font-display text-lg font-bold text-ink">Want to drive for OneShetland?</p>
              <p className="mt-1 text-sm text-ink-soft">Apply to become an approved driver. Once approved you can create runs and pick up deliveries along your route.</p>
              <Link href="/fetch/apply" className="mt-3 inline-block rounded-pill px-5 py-2.5 text-sm font-semibold text-white" style={{ background: FETCH }}>Apply to become a driver →</Link>
            </>
          ) : status === "pending" ? (
            <p className="text-sm text-ink-soft">⏳ <span className="font-semibold text-ink">Application under review.</span> We&apos;ll be in touch shortly.</p>
          ) : status === "rejected" ? (
            <p className="text-sm text-ink-soft">Your application was not approved. Contact us if you have questions.</p>
          ) : (
            <p className="text-sm text-ink-soft">Your account has been suspended. Contact support for assistance.</p>
          )}
        </div>
      )}

      {/* Bank banner */}
      {approved && !bankOk && (
        <Link href="/account/payments" className="flex items-center gap-3 rounded-card border border-amber-300 bg-amber-50 p-4 transition hover:brightness-[0.98]">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-amber-100 text-xl">💷</span>
          <span className="flex-1">
            <span className="block font-bold text-amber-900">{driverProfile?.stripe_account_id ? "Verification in progress" : "Connect your bank account"}</span>
            <span className="block text-xs text-amber-900/80">{driverProfile?.stripe_account_id ? "Stripe is reviewing your details — tap to check status" : "Required to receive payment for deliveries"}</span>
          </span>
          <span className="text-amber-700">›</span>
        </Link>
      )}

      {/* Create run CTA */}
      {approved && (
        <div>
          <Link href={canAccept ? "/fetch/runs/new" : "/account/payments"} className="inline-block rounded-pill px-6 py-3 font-semibold text-white shadow-soft transition hover:brightness-95" style={{ background: FETCH }}>+ Create a new run</Link>
          <p className="mt-2 text-sm text-ink-muted">{canAccept ? "Let customers know you're heading somewhere — they'll match requests to your run." : "Connect your bank account above to start creating runs."}</p>
        </div>
      )}

      {/* Upcoming runs */}
      {approved && (
        <section>
          <h2 className="mb-3 font-display text-2xl font-bold text-ink">Your upcoming runs {runs.length > 0 && <span className="text-ink-faint">· {runs.length}</span>}</h2>
          {runs.length === 0 ? (
            <EmptyState icon="🚗" title="No upcoming runs" body="Create a run to start accepting delivery requests." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{runs.map((r) => <RunCard key={r.id} run={r} />)}</div>
          )}
        </section>
      )}

      {/* Open requests */}
      {approved && (
        <section>
          <h2 className="mb-1 font-display text-2xl font-bold text-ink">Open requests {open.length > 0 && <span className="text-ink-faint">· {open.length}</span>}</h2>
          <p className="mb-3 text-sm text-ink-muted">{canAccept ? "Accept a request to add it to one of your runs." : "Connect your bank account to start accepting requests."}</p>
          {open.length === 0 ? (
            <EmptyState icon="📥" title="No open requests" body="New delivery requests from customers will appear here." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {open.map((r) => (
                <div key={r.id} className="rounded-card border border-line bg-paper p-4 shadow-soft">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide" style={{ color: FETCH }}>{getCategoryIcon(r.category_slug)} {getCategoryName(r.category_slug)}</span>
                    <div className="flex items-center gap-1.5">
                      {r.ready_for_collection && <span className="rounded-pill bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">Ready now</span>}
                      {r.base_fee_pence != null
                        ? <span className="rounded-pill border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-extrabold text-green-700">{penceToGBP(r.base_fee_pence)}</span>
                        : <span className="rounded-pill border border-line bg-cream px-2.5 py-1 text-xs font-semibold text-ink-muted">Fee TBC</span>}
                    </div>
                  </div>
                  <RouteBlock req={r} />
                  {r.already_paid && <p className="mt-2 text-xs font-semibold text-green-700">✓ Already paid at collection</p>}
                  <div className="mt-3">
                    <AcceptRequestButton requestId={r.id} destinationGuess={r.destination_area || r.destination_address.split(",")[0] || "Unknown"} openRuns={openRuns} disabled={!canAccept} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Active deliveries */}
      {approved && (
        <section>
          <h2 className="mb-3 font-display text-2xl font-bold text-ink">Active deliveries {activeDeliveries.length > 0 && <span className="text-ink-faint">· {activeDeliveries.length}</span>}</h2>
          {activeDeliveries.length === 0 ? (
            <EmptyState icon="📦" title="No active deliveries" body="Requests you accept will appear here to track and complete." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{activeDeliveries.map((r) => <RequestCard key={r.id} req={r} href={`/fetch/${r.id}`} />)}</div>
          )}
        </section>
      )}

      {bankOk && (
        <div className="rounded-card bg-green-50 px-4 py-3 text-sm font-medium text-green-700">✅ Bank account connected — payouts active</div>
      )}
    </div>
  );
}
