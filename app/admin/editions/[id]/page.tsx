import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeader } from "@/components/admin/AdminUI";
import { AuditList, DataTable, ErrorNote, Facts, Section, StatePill, TestPill, Td, day, when } from "@/components/admin/EditionsAdminParts";
import { GrantForm, PilotGrantForm, ModerateForm, VoidButton } from "@/components/admin/EditionsAdminForms";
import { isAdmin } from "@/lib/admin-data.server";
import { createClient } from "@/lib/supabase/server";
import { KIND_LABEL, type EditionKind } from "@/lib/editions/types";
import { FEATURE_LABEL, entitlementState, isUuid } from "../helpers";
import { auditRows, editionEntitlements, names } from "../queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edition · Editions · Admin" };

type Ed = { id: string; organiser_id: string; slug: string; title: string; summary: string | null; kind: EditionKind; starts_on: string; ends_on: string; status: string; published_at: string | null; suspended_reason: string | null; suspended_at: string | null; is_test: boolean; created_at: string; organiser: { id: string; name: string; status: string } | null };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const admin = await isAdmin();
  const sb = await createClient();
  const { data, error } = await sb.from("editions")
    .select("id, organiser_id, slug, title, summary, kind, starts_on, ends_on, status, published_at, suspended_reason, suspended_at, is_test, created_at, organiser:edition_organisers ( id, name, status )").eq("id", id).maybeSingle();
  if (error) return <ErrorNote>Could not load this Edition: {error.message}</ErrorNote>;
  if (!data) notFound();
  const e = data as unknown as Ed;
  const pilotApproved = admin ? !!(await sb.from("edition_pilot_approvals").select("id").eq("organiser_id", e.organiser_id).is("revoked_at", null).maybeSingle()).data : false;
  const [ents, audit, counts] = await Promise.all([
    editionEntitlements(id), auditRows({ editionId: id }),
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
          ["Organiser", e.organiser ? <Link key="o" href={`/admin/editions/organisers/${e.organiser.id}`} className="font-bold text-navy hover:underline">{e.organiser.name} ({e.organiser.status})</Link> : ""],
          ["Kind", KIND_LABEL[e.kind] ?? e.kind], ["Dates", `${day(e.starts_on)} to ${day(e.ends_on)}`], ["Summary", e.summary],
          ["Content", `${pg} pages, ${se} sessions, ${up} updates, ${sp} sponsors`], ["Published", e.published_at ? when(e.published_at) : ""], ["Created", when(e.created_at)],
          ["Suspended", e.suspended_at ? `${when(e.suspended_at)}: ${e.suspended_reason ?? ""}` : ""],
        ]} />
      </Section>

      <Section title="Moderation"><ModerateForm editionId={e.id} status={e.status} suspendedReason={e.suspended_reason} /></Section>

      <Section title="Entitlements">
        {ents.error ? <p className="text-sm text-ink-muted">{ents.error}</p> : !ents.rows.length ? <p className="mb-3 text-sm text-ink-muted">No entitlements. This Edition cannot be published.</p> : (
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
        {admin && pilotApproved && <div className="mb-5"><h3 className="mb-1 text-sm font-bold text-ink">Pilot publish (90 days, renewable)</h3><p className="mb-2 text-sm text-ink-soft">The organiser is approved for the pilot. Renew in the last 30 days; the new window starts where the live one ends.</p><PilotGrantForm editionId={e.id} /></div>}
        {admin ? <><h3 className="mb-2 text-sm font-bold text-ink">Grant an entitlement (general)</h3><GrantForm editionId={e.id} /></> : <p className="text-sm text-ink-muted">Only administrators can grant or void entitlements.</p>}
      </Section>

      <Section title="Audit trail"><AuditList rows={audit.rows} who={who} /></Section>
    </>
  );
}
