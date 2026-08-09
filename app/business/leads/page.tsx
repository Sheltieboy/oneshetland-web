import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { effectiveAvailability, FREE_LEADS_PER_MONTH, hasUnlimitedLeads } from "@/lib/trades";
import { TradeSettings } from "@/components/trades/TradeSettings";
import { LeadCard } from "@/components/trades/LeadCard";

/**
 * The trade's side: what you cover, whether you have room, and the jobs.
 *
 * Availability sits at the TOP, above the leads, because it's the thing that
 * decides whether any arrive and the thing most likely to go stale. A trade who
 * set it in March and stopped hearing anything in June should be able to see
 * why in one glance.
 */

export const dynamic = "force-dynamic";
export const metadata = { title: "Job leads" };

export default async function LeadsPage() {
  const account = await getAccount();
  if (!account) redirect("/sign-in?next=/business/leads");

  const sb = await createClient();
  const { data: businesses } = await sb
    .from("local_businesses")
    .select("id, name, subscription_tier, trade_categories, trade_availability, trade_availability_set_at, trade_min_job_pence, trade_credentials")
    .eq("owner_id", account.id)
    .eq("is_active", true);

  const business = (businesses ?? [])[0] as Record<string, unknown> | undefined;

  if (!business) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-16">
        <h1 className="font-display text-3xl font-bold text-navy">Job leads</h1>
        <p className="mt-3 text-ink-soft">
          You&apos;ll need a business listing first. Claim yours and you can start
          receiving jobs folk are trying to get done.
        </p>
        <Link href="/for-businesses" className="mt-5 inline-block rounded-pill bg-navy px-6 py-3 font-semibold text-paper">
          Claim your listing
        </Link>
      </main>
    );
  }

  const businessId = business.id as string;

  const { data: matches } = await sb
    .from("trade_brief_matches")
    .select("id, status, created_at, decline_reason, trade_briefs(id, title, description, trades, scale, urgency, location_text, created_at, status, contact_name, contact_phone, contact_email)")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(50);

  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const thisMonth = (matches ?? []).filter((m) => new Date(m.created_at as string) >= monthStart).length;

  const unlimited = hasUnlimitedLeads(business.subscription_tier as string);
  const availability = effectiveAvailability(
    business.trade_availability as string | null,
    business.trade_availability_set_at as string | null,
  );

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="font-display text-4xl font-bold text-navy">Job leads</h1>
      <p className="mt-1 text-ink-muted">{business.name as string}</p>

      <div className="mt-6">
        <TradeSettings
          businessId={businessId}
          initial={{
            trades: (business.trade_categories as string[] | null) ?? [],
            availability: (business.trade_availability as string | null) ?? null,
            availabilitySetAt: (business.trade_availability_set_at as string | null) ?? null,
            minJobPence: (business.trade_min_job_pence as number | null) ?? null,
            credentials: (business.trade_credentials as string[] | null) ?? [],
          }}
        />
      </div>

      {!unlimited && (
        <div className="mt-6 rounded-xl border border-line bg-sand/40 p-4">
          <p className="text-sm text-ink-soft">
            <strong className="text-ink">{thisMonth} of {FREE_LEADS_PER_MONTH}</strong> free leads
            used this month.{" "}
            {thisMonth >= FREE_LEADS_PER_MONTH
              ? "Further jobs this month go to the next trade with room."
              : "After that, jobs go to the next trade with room."}{" "}
            <Link href="/for-businesses" className="font-semibold underline">Go unlimited</Link>.
          </p>
          {/* Said plainly because a trade will assume otherwise, and the
              assumption would be corrosive: paying must not buy a head start. */}
          <p className="mt-1.5 text-xs text-ink-faint">
            Paying never puts you ahead in the queue — the order is who has room and who
            answers. It lifts the cap and adds the tools.
          </p>
        </div>
      )}

      <h2 className="mt-10 font-display text-2xl font-bold text-ink">Jobs sent to you</h2>

      {(matches ?? []).length === 0 ? (
        <p className="mt-3 text-ink-soft">
          {availability
            ? "Nothing yet. When somebody posts a job you cover, it'll appear here."
            : "You haven't said whether you have room, so jobs aren't being sent to you. Set your availability above."}
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          {(matches ?? []).map((m) => {
            // PostgREST types an embedded row as an array; it's one row here.
            const b = (Array.isArray(m.trade_briefs) ? m.trade_briefs[0] : m.trade_briefs) as Record<string, unknown> | null;
            if (!b) return null;
            const answered = m.status === "interested" || m.status === "declined";
            return (
              <LeadCard
                key={m.id as string}
                matchId={m.id as string}
                status={m.status as string}
                brief={{
                  title: b.title as string,
                  description: b.description as string,
                  trades: (b.trades as string[]) ?? [],
                  scale: b.scale as string,
                  urgency: b.urgency as string,
                  location: b.location_text as string,
                  createdAt: b.created_at as string,
                  closed: (b.status as string) !== "open",
                }}
                /* Contact is only ever handed over once they've said yes. The
                   row is fetched with it because RLS lets the owner read the
                   brief, so the gate is here — one place, easy to check. */
                contact={
                  m.status === "interested"
                    ? {
                        name: (b.contact_name as string | null) ?? null,
                        phone: (b.contact_phone as string | null) ?? null,
                        email: (b.contact_email as string | null) ?? null,
                      }
                    : null
                }
                alreadyAnswered={answered}
              />
            );
          })}
        </div>
      )}
    </main>
  );
}
