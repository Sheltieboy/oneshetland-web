import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeader } from "@/components/admin/AdminUI";
import { AuditList, DataTable, ErrorNote, Facts, ReservedPill, Section, StatePill, TestPill, Td, day, when } from "@/components/admin/EditionsAdminParts";
import { DecideOrganiserForm, LinkHubForm, MarkTestButton, PilotApprovalForm, HubVerifyForm } from "@/components/admin/EditionsAdminForms";
import { isAdmin } from "@/lib/admin-data.server";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABEL } from "@/lib/editions/types";
import { isUuid } from "../../helpers";
import { adminContactEmail, auditRows, names } from "../../queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Organiser · Editions · Admin" };

type Org = { id: string; name: string; slug: string; tagline: string | null; description: string | null; website: string | null; contact_email: string | null; status: string; verified_at: string | null; verification_note: string | null; reserved_name_flag: boolean; is_test: boolean; hub_id: string | null; created_at: string };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const admin = await isAdmin();
  const sb = await createClient();
  const { data, error } = await sb.from("edition_organisers").select("id, name, slug, tagline, description, website, status, verified_at, is_test, hub_id, created_at").eq("id", id).maybeSingle();
  const internal = ((await sb.rpc("admin_edition_org_internal", { p_org: id })).data ?? [])[0] as { verification_note: string | null; reserved_name_flag: boolean } | undefined;
  if (error) return <ErrorNote>Could not load this organiser: {error.message}</ErrorNote>;
  if (!data) notFound();
  const o = { ...(data as Org), contact_email: await adminContactEmail(id), verification_note: internal?.verification_note ?? null, reserved_name_flag: internal?.reserved_name_flag ?? false } as Org;
  const [pilotRes, hubRes] = await Promise.all([
    sb.from("edition_pilot_approvals").select("id, approved_at, note").eq("organiser_id", id).is("revoked_at", null).maybeSingle(),
    data.hub_id ? sb.from("hubs").select("name, is_active, is_verified").eq("id", data.hub_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const pilot = pilotRes.data as { id: string; approved_at: string; note: string } | null;
  const hub = hubRes.data as { name: string; is_active: boolean; is_verified: boolean | null } | null;
  const [ver, mem, eds, audit] = await Promise.all([
    sb.from("edition_organiser_verifications").select("id, evidence, requested_by, status, note, decided_at, created_at").eq("organiser_id", id).order("created_at", { ascending: false }),
    sb.from("edition_organiser_members").select("user_id, role, created_at").eq("organiser_id", id),
    sb.from("editions").select("id, title, slug, status, is_test, starts_on, ends_on").eq("organiser_id", id).order("starts_on", { ascending: false }),
    auditRows({ organiserId: id }),
  ]);
  const verifications = (ver.data ?? []) as { id: string; evidence: string; requested_by: string | null; status: string; note: string | null; decided_at: string | null; created_at: string }[];
  const members = (mem.data ?? []) as { user_id: string; role: keyof typeof ROLE_LABEL; created_at: string }[];
  const editions = (eds.data ?? []) as { id: string; title: string; slug: string; status: string; is_test: boolean; starts_on: string; ends_on: string }[];
  const who = await names([...verifications.map((v) => v.requested_by), ...members.map((m) => m.user_id), ...audit.rows.map((a) => a.actor)]);

  return (
    <>
      <p className="mb-2 text-sm"><Link href="/admin/editions?tab=organisers" className="font-bold text-navy hover:underline">← Organisers</Link></p>
      <AdminHeader title={o.name} sub={`/${o.slug}`} />
      <div className="mb-4 flex flex-wrap gap-2"><StatePill s={o.status} />{o.reserved_name_flag && <ReservedPill />}{o.is_test && <TestPill />}</div>

      <Section title="Profile">
        <Facts rows={[["Tagline", o.tagline], ["Description", o.description], ["Website", o.website], ["Contact email", o.contact_email], ["Created", when(o.created_at)],
          ["Verified", o.verified_at ? when(o.verified_at) : ""], ["Verification note", o.verification_note], ["Linked hub", o.hub_id]]} />
      </Section>

      <Section title="Verification evidence">
        {!verifications.length ? <p className="text-sm text-ink-muted">No verification request has been made.</p> : (
          <ul className="space-y-3">{verifications.map((v) => (
            <li key={v.id} className="rounded-lg border border-line p-3 text-sm">
              <div className="mb-1 flex flex-wrap items-center gap-2"><StatePill s={v.status === "approved" ? "verified" : v.status} /><span className="text-xs text-ink-muted">Requested {when(v.created_at)} by {v.requested_by ? who[v.requested_by] ?? "a user" : "unknown"}</span></div>
              <p className="whitespace-pre-line text-ink">{v.evidence}</p>
              {v.note && <p className="mt-1 text-ink-soft">Decision note: {v.note}</p>}
            </li>))}</ul>
        )}
      </Section>

      <Section title="Decision">
        {o.reserved_name_flag && <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-900">This name matches a reserved list of real organisations. Verify only with evidence that the requester genuinely represents it, and record that in the note.</p>}
        <DecideOrganiserForm organiserId={o.id} status={o.status} reserved={o.reserved_name_flag} isAdmin={admin} />
      </Section>

      <Section title="Team">
        {!members.length ? <p className="text-sm text-ink-muted">No members readable.</p> : (
          <DataTable head={["Person", "Role", "Joined"]}>{members.map((m) => <tr key={m.user_id}><Td>{who[m.user_id] ?? "Unnamed user"}</Td><Td>{ROLE_LABEL[m.role] ?? m.role}</Td><Td className="text-ink-muted">{day(m.created_at)}</Td></tr>)}</DataTable>
        )}
      </Section>

      <Section title="Editions">
        {!editions.length ? <p className="text-sm text-ink-muted">No Editions yet.</p> : (
          <DataTable head={["Edition", "Status", "Dates"]}>{editions.map((e) => (
            <tr key={e.id}><Td><Link href={`/admin/editions/${e.id}`} className="font-bold text-navy hover:underline">{e.title}</Link> {e.is_test && <TestPill />}</Td><Td><StatePill s={e.status} /></Td><Td className="whitespace-nowrap text-ink-soft">{day(e.starts_on)} to {day(e.ends_on)}</Td></tr>))}</DataTable>
        )}
      </Section>

      {admin && (
        <Section title="Pilot access">
          <Facts rows={[["Pilot approval", pilot ? `Approved ${when(pilot.approved_at)}: ${pilot.note}` : "Not approved. Nothing from this organiser is public through the pilot."],
            ...(o.hub_id ? [["Hub", hub ? `${hub.name} (${hub.is_active ? "active" : "NOT active"}, ${hub.is_verified ? "verified" : "NOT verified"})` : "Not found"] as [string, string]] : [])]} />
          {!pilot && o.hub_id && hub && !hub.is_verified && <p className="my-3 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-900">This Hub is not verified. Verify the Hub first; the database will not approve a Hub-run organiser until you have.</p>}
          {o.hub_id && hub && hub.is_active && !hub.is_verified && <div className="my-3"><HubVerifyForm hubId={o.hub_id} verified={false} /></div>}
          {!pilot && o.status !== "verified" && <p className="my-3 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-900">Verify the organiser first.</p>}
          <div className="mt-3"><PilotApprovalForm organiserId={o.id} approved={!!pilot} /></div>
        </Section>
      )}

      {admin && (
        <>
          <Section title="Link to a hub"><LinkHubForm organiserId={o.id} current={o.hub_id} /></Section>
          {!o.is_test && <Section title="Test organisation"><p className="mb-2 text-sm text-ink-soft">Marking an organiser as test hides it and its Editions from the public. It cannot be undone from here.</p><MarkTestButton organiserId={o.id} label="Mark organiser as test" /></Section>}
        </>
      )}

      <Section title="Audit trail"><AuditList rows={audit.rows} who={who} /></Section>
    </>
  );
}
