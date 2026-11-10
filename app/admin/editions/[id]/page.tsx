import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeader } from "@/components/admin/AdminUI";
import { AuditList, DataTable, ErrorNote, Facts, Section, StatePill, TestPill, Td, day, when } from "@/components/admin/EditionsAdminParts";
import { GrantForm, ModerateForm, VoidButton } from "@/components/admin/EditionsAdminForms";
import { isAdmin } from "@/lib/admin-data.server";
import { createClient } from "@/lib/supabase/server";
import { KIND_LABEL, type EditionKind } from "@/lib/editions/types";
import { FEATURE_LABEL, entitlementState, isUuid } from "../helpers";
import { auditRows, editionEntitlements, editionOrders, names } from "../queries";
import { OrderRefund } from "@/components/admin/EditionOrders";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edition · Editions · Admin" };

type Ed = { id: string; organiser_id: string; review_state: string; slug: string; title: string; summary: string | null; kind: EditionKind; starts_on: string; ends_on: string; status: string; published_at: string | null; suspended_reason: string | null; suspended_at: string | null; is_test: boolean; created_at: string; organiser: { id: string; name: string; status: string } | null };

const REVIEW_WORDS: Record<string, string> = { not_submitted: "Draft, not submitted", submitted: "Waiting for review", changes_requested: "Changes requested", approved: "Approved", rejected: "Rejected" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const admin = await isAdmin();
  const sb = await createClient();
  const { data, error } = await sb.from("editions")
    .select("id, organiser_id, review_state, slug, title, summary, kind, starts_on, ends_on, status, published_at, suspended_reason, suspended_at, is_test, created_at, organiser:edition_organisers ( id, name, status )").eq("id", id).maybeSingle();
  if (error) return <ErrorNote>Could not load this Edition: {error.message}</ErrorNote>;
  if (!data) notFound();
  const e = data as unknown as Ed;
  const [ents, audit, orders, counts] = await Promise.all([
    editionEntitlements(id), auditRows({ editionId: id }), editionOrders(id),
    Promise.all(["edition_pages", "edition_sessions", "edition_updates", "edition_sponsors"].map((t) => sb.from(t).select("id", { count: "exact", head: true }).eq("edition_id", id))),
  ]);
  const who = await names(audit.rows.map((a) => a.actor));
  const [pg, se, up, sp] = counts.map((c) => c.count ?? 0);

  return (
    <>
      <p className="mb-2 text-sm"><Link href="/admin/editions?tab=editions" className="font-bold text-navy hover:underline">← Editions</Link></p>
      <AdminHeader title={e.title} sub={`/${e.slug}`} />
      <div className="mb-4 flex flex-wrap gap-2"><StatePill s={e.status} />{e.is_test && <TestPill />}</div>

      <Section title="Overview">
        <Facts rows={[
          ["Review", <Link key="r" href={`/admin/editions/approvals/${e.id}`} className="font-bold text-navy hover:underline">{REVIEW_WORDS[e.review_state] ?? e.review_state}: open the review</Link>],
          ["Organiser", e.organiser ? <Link key="o" href={`/admin/editions/organisers/${e.organiser.id}`} className="font-bold text-navy hover:underline">{e.organiser.name} ({e.organiser.status})</Link> : ""],
          ["Kind", KIND_LABEL[e.kind] ?? e.kind], ["Dates", `${day(e.starts_on)} to ${day(e.ends_on)}`], ["Summary", e.summary],
          ["Content", `${pg} pages, ${se} sessions, ${up} updates, ${sp} sponsors`], ["Published", e.published_at ? when(e.published_at) : ""], ["Created", when(e.created_at)],
          ["Suspended", e.suspended_at ? `${when(e.suspended_at)}: ${e.suspended_reason ?? ""}` : ""],
        ]} />
      </Section>

      <Section title="Moderation"><ModerateForm editionId={e.id} status={e.status} suspendedReason={e.suspended_reason} /></Section>

      <Section title="Package and manual adjustments">
        {ents.error ? <p className="text-sm text-ink-muted">{ents.error}</p> : !ents.rows.length ? <p className="mb-3 text-sm text-ink-muted">No package yet. This Edition cannot go live until the organiser chooses one.</p> : (
          <div className="mb-4"><DataTable head={["Feature", "State", "Window", "Source and reason", ""]}>
            {ents.rows.map((n) => {
              const st = entitlementState(n);
              return (
                <tr key={n.id}>
                  <Td>{FEATURE_LABEL[n.feature] ?? n.feature}</Td><Td><StatePill s={st} /></Td>
                  <Td className="whitespace-nowrap text-ink-soft">{day(n.starts_at)} to {day(n.ends_at)}</Td>
                  <Td className="text-ink-soft">{n.source.replace("_", " ")}{n.reason ? `: ${n.reason}` : ""}{n.void_reason ? ` (voided: ${n.void_reason})` : ""}</Td>
                  <Td className="min-w-48">{admin && (st === "live" || st === "scheduled") ? <VoidButton entitlementId={n.id} editionId={e.id} /> : null}</Td>
                </tr>
              );
            })}
          </DataTable></div>
        )}
        {admin ? <><h3 className="mb-1 text-sm font-bold text-ink">Manual package adjustment</h3><p className="mb-2 text-sm text-ink-soft">An exception tool for refunds and goodwill. Organisers normally choose and pay for their own package once the Edition is approved.</p><GrantForm editionId={e.id} /></> : <p className="text-sm text-ink-muted">Only administrators can grant or void entitlements.</p>}
      </Section>

      <Section title="Package orders and refunds">
        {orders.error ? <p className="text-sm text-ink-muted">{orders.error}</p> : !orders.rows.length ? <p className="text-sm text-ink-muted">No package has been chosen for this Edition yet.</p> : (
          <ul className="space-y-3">{orders.rows.map((o) => <OrderRefund key={o.order_id} order={o} editionId={e.id} refunds={o.refunds} />)}</ul>
        )}
      </Section>

      <Section title="Audit trail"><AuditList rows={audit.rows} who={who} /></Section>
    </>
  );
}
