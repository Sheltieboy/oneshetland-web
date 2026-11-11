import Link from "next/link";
import { requireAdmin } from "@/lib/admin-data.server";
import { createClient } from "@/lib/supabase/server";
import { EditionsFeeReports } from "@/components/admin/EditionsFeeReports";
import { EditionsTabs } from "@/components/admin/EditionsAdminParts";
import { reviewCounts } from "../../queries";
import { RANGES, rangeDays, rangeWindow } from "./range";

export const dynamic = "force-dynamic";
export const metadata = { title: "Editions fee reports" };

export default async function FeeReportsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await requireAdmin();
  const days = rangeDays((await searchParams).range);
  const sb = await createClient();
  const { from, to } = rangeWindow(days);
  const [statement, byMonth, byOrg, items, disputes, notes] = await Promise.all([
    sb.rpc("admin_edition_fee_statement", { p_from: from, p_to: to }),
    sb.rpc("admin_edition_variance_report", { p_from: from, p_to: to, p_group: "month" }),
    sb.rpc("admin_edition_variance_report", { p_from: from, p_to: to, p_group: "organiser" }),
    sb.rpc("admin_edition_variance_items", { p_from: from, p_to: to }),
    sb.from("edition_dispute_recoveries").select("dispute_id, amount_pence, fee_pence, reason, state, recovery_pence, status, blocked, attempts, last_error, created_at, resolved_at, edition_organisers(name)").order("created_at", { ascending: false }).limit(200),
    sb.rpc("admin_edition_fee_model_notes"),
  ]);
  return (
    <div className="space-y-6">
      <EditionsTabs active="commerce" waiting={(await reviewCounts()).waiting} />
      <div>
        <p className="text-sm text-ink-muted"><Link href="/admin/editions/commerce" className="hover:underline">Commerce</Link> / Fee reports</p>
        <h1 className="font-display text-3xl font-bold text-ink">Fee statement, variance and disputes</h1>
        <nav aria-label="Period" className="mt-3 flex flex-wrap gap-2">{RANGES.map((r) => (<Link key={r.key} href={`/admin/editions/commerce/reports?range=${r.key}`} aria-current={r.days === days ? "page" : undefined} className={"inline-flex min-h-11 items-center rounded-pill px-4 text-sm font-bold " + (r.days === days ? "bg-navy text-white" : "border border-line-strong text-ink-soft hover:bg-sand")}>{r.label}</Link>))}</nav>
      </div>
      <EditionsFeeReports days={days} statement={(statement.data ?? []) as never} byMonth={(byMonth.data ?? []) as never} byOrganiser={(byOrg.data ?? []) as never} items={(items.data ?? []) as never} disputes={(disputes.data ?? []) as never} notes={(notes.data ?? null) as never} />
    </div>
  );
}
