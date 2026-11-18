import { requireAdmin } from "@/lib/admin-data.server";
import { createClient } from "@/lib/supabase/server";
import { EditionsTabs } from "@/components/admin/EditionsAdminParts";
import { EditionsPromoCalendar } from "@/components/admin/EditionsPromoCalendar";
import { reviewCounts } from "../queries";
import { bookingRows, parseCalendar, parseCandidates, parseRange } from "./calendar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Editions promotions" };

export default async function PromotionsPage({ searchParams }: { searchParams: Promise<{ from?: string | string[]; to?: string | string[] }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const range = parseRange(one(sp.from), one(sp.to));
  const sb = await createClient();
  const [cal, eds, cand] = await Promise.all([
    sb.rpc("admin_edition_promo_calendar", { p_from: range.from, p_to: range.to }),
    sb.from("editions").select("id, title, starts_on, status, organiser:edition_organisers ( name )").eq("status", "published").order("title").limit(300),
    // Everything an administrator needs to choose WITHOUT opening the entitlement or organiser screens: who runs it,
    // when it runs, and how long its publishing period has left (which caps the booking).
    sb.rpc("admin_edition_promo_candidates"),
  ]);
  const days = parseCalendar(cal.data);
  const editions = ((eds.data ?? []) as unknown as { id: string; title: string; starts_on: string; organiser: { name: string } | { name: string }[] | null }[]).map((e) => ({ id: e.id, label: `${e.title}${(Array.isArray(e.organiser) ? e.organiser[0]?.name : e.organiser?.name) ? ` (${Array.isArray(e.organiser) ? e.organiser[0]?.name : e.organiser?.name})` : ""}` }));
  return (
    <div className="space-y-6">
      <EditionsTabs active="promotions" waiting={(await reviewCounts()).waiting} />
      <div><h1 className="font-display text-3xl font-bold text-ink">Promotions</h1><p className="mt-1 max-w-2xl text-sm text-ink-soft">Who is booked on the homepage and in enhanced discovery, and how full each day is. Feature an Edition here, or cancel, move and grant days — always with a reason, and always inside the same availability rules organisers book under.</p></div>
      <EditionsPromoCalendar range={range} days={days} bookings={bookingRows(days)} editions={editions} candidates={parseCandidates(cand.data)} error={cal.error ? "The calendar could not be loaded. Check that the promotion migrations are applied." : null} />
    </div>
  );
}
