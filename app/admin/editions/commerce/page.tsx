import Link from "next/link";
import { requireAdmin } from "@/lib/admin-data.server";
import { createClient } from "@/lib/supabase/server";
import { EditionsCommerceAdmin } from "@/components/admin/EditionsCommerceAdmin";
import { COMMERCE_KEYS } from "./config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Editions commerce" };

export default async function CommercePage() {
  await requireAdmin();
  const sb = await createClient();
  const to = new Date(Date.now() + 864e5).toISOString(), from = new Date(Date.now() - 90 * 864e5).toISOString();
  const [cfg, pk, orgs, ents, exc, fees, payouts] = await Promise.all([
    sb.from("admin_config").select("key, value").in("key", COMMERCE_KEYS.map((c) => c.key)),
    sb.from("edition_packages").select("*").order("sort"),
    sb.from("edition_organisers").select("id, name, status").order("name"),
    sb.from("edition_organiser_entitlements").select("id, organiser_id, feature, max_value, ends_at, source, reason").is("voided_at", null).gt("ends_at", new Date().toISOString()).order("ends_at"),
    sb.from("edition_reconciliation_exceptions").select("id, kind, provider_ref, detail, created_at, organiser_id").eq("status", "open").order("created_at", { ascending: false }).limit(50),
    sb.rpc("admin_edition_fee_statement", { p_from: from, p_to: to }),
    sb.from("edition_payout_accounts").select("organiser_id, collection_suspended"),
  ]);
  const config = Object.fromEntries(((cfg.data ?? []) as { key: string; value: string }[]).map((r) => [r.key, r.value]));
  const susp = new Set(((payouts.data ?? []) as { organiser_id: string; collection_suspended: boolean }[]).filter((p) => p.collection_suspended).map((p) => p.organiser_id));
  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-muted"><Link href="/admin/editions" className="hover:underline">Editions</Link></nav>
      <div><h1 className="font-display text-3xl font-bold text-ink">Commerce</h1><p className="mt-1 max-w-2xl text-sm text-ink-soft">The commercial model for organiser memberships, Edition participation and packages. Payments are off by default.</p></div>
      <EditionsCommerceAdmin config={config} packages={(pk.data ?? []) as never} organisers={((orgs.data ?? []) as { id: string; name: string; status: string }[]).map((o) => ({ ...o, collection_suspended: susp.has(o.id) }))} entitlements={(ents.data ?? []) as never} exceptions={(exc.data ?? []) as never} fees={(fees.data ?? []) as never} />
    </div>
  );
}
