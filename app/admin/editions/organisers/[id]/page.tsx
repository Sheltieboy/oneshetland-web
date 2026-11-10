import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeader } from "@/components/admin/AdminUI";
import { AuditList, DataTable, ErrorNote, Facts, ParentPill, ReservedPill, Section, StatePill, TestPill, Td, day, when } from "@/components/admin/EditionsAdminParts";
import { DecideOrganiserForm, MarkTestButton } from "@/components/admin/EditionsAdminForms";
import { isAdmin } from "@/lib/admin-data.server";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABEL } from "@/lib/editions/types";
import { isUuid } from "../../helpers";
import { adminContactEmail, auditRows, names } from "../../queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Organiser · Editions · Admin" };

type Org = { id: string; name: string; slug: string; tagline: string | null; description: string | null; website: string | null; contact_email: string | null; status: string; verified_at: string | null; verification_note: string | null; reserved_name_flag: boolean; is_test: boolean; hub_id: string | null; business_id: string | null; created_at: string };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const admin = await isAdmin();
  const sb = await createClient();
  const { data, error } = await sb.from("edition_organisers").select("id, name, slug, tagline, description, website, status, verified_at, is_test, hub_id, business_id, created_at").eq("id", id).maybeSingle();
  const internal = ((await sb.rpc("admin_edition_org_internal", { p_org: id })).data ?? [])[0] as { verification_note: string | null; reserved_name_flag: boolean } | undefined;
  if (error) return <ErrorNote>Could not load this organiser: {error.message}</ErrorNote>;
  if (!data) notFound();
  const o = { ...(data as Org), contact_email: await adminContactEmail(id), verification_note: internal?.verification_note ?? null, reserved_name_flag: internal?.reserved_name_flag ?? false } as Org;
  const parentRes = data.hub_id ? await sb.from("hubs").select("name, is_active").eq("id", data.hub_id).maybeSingle()
    : data.business_id ? await sb.from("local_businesses").select("name, is_active").eq("id", data.business_id).maybeSingle() : { data: null };
  const parent = parentRes.data as { name: string; is_active: boolean } | null;
  const parentKind = data.hub_id ? "hub" : data.business_id ? "business" : null;
  const [mem, eds, audit] = await Promise.all([
    sb.from("edition_organiser_members").select("user_id, role, created_at").eq("organiser_id", id),
    sb.from("editions").select("id, title, slug, status, is_test, starts_on, ends_on").eq("organiser_id", id).order("starts_on", { ascending: false }),
    auditRows({ organiserId: id }),
  ]);
  const members = (mem.data ?? []) as { user_id: string; role: keyof typeof ROLE_LABEL; created_at: string }[];
  const editions = (eds.data ?? []) as { id: string; title: string; slug: string; status: string; is_test: boolean; starts_on: string; ends_on: string }[];
  const who = await names([...members.map((m) => m.user_id), ...audit.rows.map((a) => a.actor)]);

  return (
    <>
      <p className="mb-2 text-sm"><Link href="/admin/editions?tab=organisers" className="font-bold text-navy hover:underline">← Organisers</Link></p>
      <AdminHeader title={o.name} sub={`/${o.slug}`} />
      <div className="mb-4 flex flex-wrap gap-2"><StatePill s={o.status} />{o.reserved_name_flag && <ReservedPill />}{o.is_test && <TestPill />}</div>

      <Section title="Profile">
        <Facts rows={[["Run by", parent ? <span key="p" className="inline-flex flex-wrap items-center gap-2">{parent.name} <ParentPill kind={parentKind} />{!parent.is_active && <span className="font-bold text-rose-700">Not active</span>}</span> : ""], ["Tagline", o.tagline], ["Description", o.description], ["Website", o.website], ["Contact email", o.contact_email], ["Created", when(o.created_at)],
          ["Identity checked", o.verified_at ? when(o.verified_at) : "Not yet: it is checked when its first Edition is approved"], ["Check note", o.verification_note]]} />
      </Section>

      <Section title="Suspend or reinstate">
        <p className="mb-3 text-sm text-ink-soft">Suspending hides this organiser and all its Editions from the public. Reinstating brings them back. Identity is checked when the first Edition is approved, so there is nothing to verify here.</p>
        <DecideOrganiserForm organiserId={o.id} status={o.status} isAdmin={admin} />
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

      {admin && !o.is_test && <Section title="Test organisation"><p className="mb-2 text-sm text-ink-soft">Marking an organiser as test hides it and its Editions from the public. It cannot be undone from here.</p><MarkTestButton organiserId={o.id} label="Mark organiser as test" /></Section>}

      <Section title="Audit trail"><AuditList rows={audit.rows} who={who} /></Section>
    </>
  );
}
