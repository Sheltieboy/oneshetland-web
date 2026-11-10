import { createClient } from "@/lib/supabase/server";
import { getOrgPayments } from "@/lib/editions/commerce.server";
import { paymentsCsv } from "@/lib/editions/commerce";

export const dynamic = "force-dynamic";

/** CSV of the organiser's payments. Needs an organiser admin AND the csv_export entitlement (checked by the database); anything else is a 404 so nothing is revealed. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return new Response("Sign in", { status: 401 });
  const { data: org } = await sb.from("edition_organisers").select("id, slug").eq("slug", (await params).slug).maybeSingle();
  if (!org) return new Response("Not found", { status: 404 });
  const { data: role } = await sb.rpc("edition_org_role", { p_org: org.id });
  const { data: entitled } = await sb.rpc("edition_org_entitled", { p_org: org.id, p_feature: "csv_export" });
  if (!(role === "owner" || role === "admin") || entitled !== true) return new Response("Not found", { status: 404 });
  const rows = await getOrgPayments(org.id);
  return new Response(paymentsCsv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${org.slug}-payments.csv"`, "Cache-Control": "private, no-store" } });
}
