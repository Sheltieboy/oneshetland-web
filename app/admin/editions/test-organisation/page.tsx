import Link from "next/link";
import { AdminHeader } from "@/components/admin/AdminUI";
import { Section, StatePill, TestPill } from "@/components/admin/EditionsAdminParts";
import { TestOrgRunner } from "@/components/admin/EditionsAdminTestOrg";
import { createClient } from "@/lib/supabase/server";
import { TEST_EDITION_SLUG, TEST_ORG } from "../helpers";

export const dynamic = "force-dynamic";
export const metadata = { title: "Test organisation · Editions · Admin" };

export default async function Page() {
  const sb = await createClient();
  const [{ data: o }, { data: e }] = await Promise.all([
    sb.from("edition_organisers").select("id, name, status, is_test").eq("slug", TEST_ORG.slug).maybeSingle(),
    sb.from("editions").select("id, title, status, is_test").eq("slug", TEST_EDITION_SLUG).maybeSingle(),
  ]);
  const org = o as { id: string; name: string; status: string; is_test: boolean } | null;
  const ed = e as { id: string; title: string; status: string; is_test: boolean } | null;
  return (
    <>
      <p className="mb-2 text-sm"><Link href="/admin/editions" className="font-bold text-navy hover:underline">← Editions</Link></p>
      <AdminHeader title="Private test organisation" sub="A ZZ TEST organiser and Edition for staff acceptance testing, built through the real verification, entitlement and publishing paths. The public never sees it." />
      <Section title="Current state">
        {!org ? <p className="text-sm text-ink-muted">Not created yet.</p> : (
          <ul className="space-y-2 text-sm">
            <li className="flex flex-wrap items-center gap-2"><Link href={`/admin/editions/organisers/${org.id}`} className="font-bold text-navy hover:underline">{org.name}</Link><StatePill s={org.status} />{org.is_test ? <TestPill /> : <span className="text-rose-700">Not marked as test</span>}</li>
            <li className="flex flex-wrap items-center gap-2">{ed ? <><Link href={`/admin/editions/${ed.id}`} className="font-bold text-navy hover:underline">{ed.title}</Link><StatePill s={ed.status} />{ed.is_test ? <TestPill /> : <span className="text-rose-700">Not marked as test</span>}</> : <span className="text-ink-muted">No Edition yet.</span>}</li>
          </ul>
        )}
      </Section>
      <Section title="Create or repair"><TestOrgRunner exists={!!org} /></Section>
    </>
  );
}
