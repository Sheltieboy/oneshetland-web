import Link from "next/link";
import { requireBusinessOwner } from "@/lib/business-server";
import { createClient } from "@/lib/supabase/server";
import { effectiveAvailability } from "@/lib/trades";
import { getLeadContact } from "@/lib/trades-actions";
import { TradeSettings } from "@/components/trades/TradeSettings";
import { LeadCard } from "@/components/trades/LeadCard";
import { HelpTip } from "@/components/help/HelpTip";

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
    .select("id, status, created_at, contact_shared_at, trade_briefs(title, description, trades, scale, urgency, location_text, created_at, status)")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .limit(50);

  /*
   * Opening this page is "seeing" the leads. Done here, on the server, once per
   * render and only for leads still at 'sent' (the database only ever moves
   * sent -> viewed, so it is safe to repeat). The cards still show "New" for
   * the ones that were unseen when this page loaded.
   */
  const unseen = new Set(
    (matches ?? []).filter((m) => m.status === "sent").map((m) => m.id as string),
  );
  await Promise.all([...unseen].map((id) => sb.rpc("mark_trade_lead_viewed", { p_match: id })));

  // Contact is fetched only where the customer chose to share it.
  const contacts = new Map<string, { name: string | null; phone: string | null; email: string | null } | null>();
  await Promise.all(
    (matches ?? [])
      .filter((m) => m.status === "interested" && m.contact_shared_at)
      .map(async (m) => { contacts.set(m.id as string, (await getLeadContact(m.id as string)).contact); }),
  );

  const live = effectiveAvailability(
    (row?.trade_availability as string | null) ?? null,
    (row?.trade_availability_set_at as string | null) ?? null,
  );

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Link href={`/business/${business.id}/manage`} className="text-sm font-semibold text-ink-soft hover:text-ink">
        ← {business.name}
      </Link>
      <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl flex items-center gap-2.5">
          Job leads
          <HelpTip topic="trade-availability" />
        </h1>
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
                contact={contacts.get(m.id as string) ?? null}
                contactShared={Boolean(m.contact_shared_at)}
                isNew={unseen.has(m.id as string)}
                alreadyAnswered={m.status === "interested" || m.status === "declined"}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
