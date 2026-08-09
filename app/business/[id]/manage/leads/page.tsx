import Link from "next/link";
import { requireBusinessOwner } from "@/lib/business-server";
import { createClient } from "@/lib/supabase/server";
import { effectiveAvailability, FREE_LEADS_PER_MONTH, hasUnlimitedLeads } from "@/lib/trades";
import { TradeSettings } from "@/components/trades/TradeSettings";
import { LeadCard } from "@/components/trades/LeadCard";

/**
 * Job leads, inside the business management hub where everything else lives.
 *
 * Availability sits ABOVE the leads on purpose: it decides whether any arrive,
 * and it's the thing most likely to go stale. A trade who set it in March and
 * stopped hearing anything by June should see why in one glance.
 */

export const dynamic = "force-dynamic";
export const metadata = { title: "Job leads" };

export default async function BusinessLeadsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusinessOwner(id);
  const sb = await createClient();

  const { data: row } = await sb
    .from("local_businesses")
    .select("subscription_tier, trade_categories, trade_availability, trade_availability_set_at, trade_min_job_pence, trade_credentials")
    .eq("id", business.id)
    .single();

  const { data: matches } = await sb
    .from("trade_brief_matches")
    .select("id, status, created_at, trade_briefs(title, description, trades, scale, urgency, location_text, created_at, status, contact_name, contact_phone, contact_email)")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const thisMonth = (matches ?? []).filter((m) => new Date(m.created_at as string) >= monthStart).length;

  const unlimited = hasUnlimitedLeads(row?.subscription_tier as string);
  const live = effectiveAvailability(
    (row?.trade_availability as string | null) ?? null,
    (row?.trade_availability_set_at as string | null) ?? null,
  );

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Link href={`/business/${business.id}/manage`} className="text-sm font-semibold text-ink-soft hover:text-ink">
        ← {business.name}
      </Link>
      <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Job leads</h1>
      <p className="mt-1 text-ink-muted">
        Folk across Shetland looking for somebody to do a job.
      </p>

      <div className="mt-6">
        <TradeSettings
          businessId={business.id}
          initial={{
            trades: (row?.trade_categories as string[] | null) ?? [],
            availability: (row?.trade_availability as string | null) ?? null,
            availabilitySetAt: (row?.trade_availability_set_at as string | null) ?? null,
            minJobPence: (row?.trade_min_job_pence as number | null) ?? null,
            credentials: (row?.trade_credentials as string[] | null) ?? [],
          }}
        />
      </div>

      {!unlimited && (
        <div className="mt-6 rounded-xl border border-line bg-sand/40 p-4">
          <p className="text-sm text-ink-soft">
            <strong className="text-ink">{thisMonth} of {FREE_LEADS_PER_MONTH}</strong> free leads used
            this month.{" "}
            {thisMonth >= FREE_LEADS_PER_MONTH
              ? "Further jobs this month go to the next trade with room."
              : "After that, jobs go to the next trade with room."}{" "}
            <Link href={`/business/${business.id}/manage/billing`} className="font-semibold underline">Go unlimited</Link>.
          </p>
          {/* Stated plainly because a trade will assume the opposite, and the
              assumption would be corrosive to the whole thing. */}
          <p className="mt-1.5 text-xs text-ink-faint">
            Paying never puts you ahead in the queue — the order is who has room and who answers.
            It lifts the cap and adds the tools.
          </p>
        </div>
      )}

      <h2 className="mt-10 font-display text-2xl font-bold text-ink">Jobs sent to you</h2>

      {(matches ?? []).length === 0 ? (
        <p className="mt-3 text-ink-soft">
          {live
            ? "Nothing yet. When somebody posts a job you cover, it'll appear here."
            : "You haven't said whether you have room, so jobs aren't being sent to you. Set your availability above."}
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          {(matches ?? []).map((m) => {
            // PostgREST types an embedded row as an array; it's one row here.
            const b = (Array.isArray(m.trade_briefs) ? m.trade_briefs[0] : m.trade_briefs) as Record<string, unknown> | null;
            if (!b) return null;
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
                contact={
                  m.status === "interested"
                    ? {
                        name: (b.contact_name as string | null) ?? null,
                        phone: (b.contact_phone as string | null) ?? null,
                        email: (b.contact_email as string | null) ?? null,
                      }
                    : null
                }
                alreadyAnswered={m.status === "interested" || m.status === "declined"}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
