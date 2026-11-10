import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminHeader, Empty } from "@/components/admin/AdminUI";
import { AuditList, DataTable, EditionsTabs, ErrorNote, FilterLinks, ParentPill, ReservedPill, StatePill, TestPill, Td, day } from "@/components/admin/EditionsAdminParts";
import { FEATURE_LABEL, entitlementState, one, parseTab } from "./helpers";
import { auditRows, editionRows, entitlementRows, names, organisersWithParents, reviewCounts } from "./queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Editions · Admin" };

/** Admin → Editions. The landing page is Edition approvals. Reads run as the signed-in administrator (RLS); the layout already requires an administrator. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const tab = parseTab(sp.tab);
  if (tab === "approvals") redirect("/admin/editions/approvals");
  if (tab === "commerce") redirect("/admin/editions/commerce");
  const status = one(sp.status), test = one(sp.test), ent = one(sp.state);
  const counts = await reviewCounts();

  return (
    <>
      <AdminHeader title="Editions" sub="Moderate Editions and organisers, adjust packages by hand when needed, and read the audit trail." />
      <EditionsTabs active={tab} waiting={counts.waiting} />
      {tab === "organisers" && <Organisers status={status} />}
      {tab === "editions" && <Editions status={status} test={test} />}
      {tab === "entitlements" && <Entitlements state={ent} />}
      {tab === "audit" && <Audit />}
    </>
  );
}

async function Organisers({ status }: { status: string }) {
  const r = await organisersWithParents(status);
  return (
    <>
      <p className="mb-3 text-sm text-ink-muted">An organiser is the Editions profile of one Business or Hub. It is created automatically and verified when its first Edition is approved. From here you can only suspend or reinstate one.</p>
      <FilterLinks base={{ tab: "organisers" }} param="status" current={status} options={[{ value: "", label: "All" }, ...["pending", "verified", "rejected", "suspended"].map((v) => ({ value: v, label: v === "pending" ? "Identity not checked" : v[0].toUpperCase() + v.slice(1) }))]} />
      {r.error ? <ErrorNote>{r.error}</ErrorNote> : !r.rows.length ? <Empty>No organisers match.</Empty> : (
        <ul className="space-y-3 md:hidden" aria-label="Organisers">
          {r.rows.map((o) => (
            <li key={o.id} className="rounded-card border border-line bg-paper p-4 shadow-soft">
              <Link href={`/admin/editions/organisers/${o.id}`} className="font-bold text-navy hover:underline">{o.name}</Link>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-soft">Run by {o.parent_name ?? "unknown"} <ParentPill kind={o.parent_kind} /></p>
              <div className="mt-2 flex flex-wrap gap-1.5"><StatePill s={o.status} />{o.reserved_name_flag && <ReservedPill />}{o.is_test && <TestPill />}</div>
            </li>
          ))}
        </ul>
      )}
      {!r.error && r.rows.length > 0 && (
        <div className="hidden md:block">
          <DataTable head={["Organiser", "Run by", "Status", "Created"]}>
            {r.rows.map((o) => (
              <tr key={o.id}>
                <Td><Link href={`/admin/editions/organisers/${o.id}`} className="font-bold text-navy hover:underline">{o.name}</Link>
                  <div className="mt-1 flex gap-1">{o.reserved_name_flag && <ReservedPill />}{o.is_test && <TestPill />}</div></Td>
                <Td><span className="mr-2">{o.parent_name ?? "Unknown"}</span><ParentPill kind={o.parent_kind} /></Td>
                <Td><StatePill s={o.status} /></Td>
                <Td className="whitespace-nowrap text-ink-muted">{day(o.created_at)}</Td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}
    </>
  );
}

async function Editions({ status, test }: { status: string; test: string }) {
  const r = await editionRows(status, test);
  const base = { tab: "editions", ...(test ? { test } : {}) }, base2 = { tab: "editions", ...(status ? { status } : {}) };
  return (
    <>
      <FilterLinks base={base} param="status" current={status} options={[{ value: "", label: "Any status" }, ...["draft", "published", "archived", "suspended"].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }))]} />
      <FilterLinks base={base2} param="test" current={test} options={[{ value: "", label: "Real and test" }, { value: "real", label: "Real only" }, { value: "test", label: "Test only" }]} />
      {r.error ? <ErrorNote>{r.error}</ErrorNote> : !r.rows.length ? <Empty>No Editions match.</Empty> : (
        <DataTable head={["Edition", "Organiser", "Status", "Dates"]}>
          {r.rows.map((e) => (
            <tr key={e.id}>
              <Td><Link href={`/admin/editions/${e.id}`} className="font-bold text-navy hover:underline">{e.title}</Link> {e.is_test && <TestPill />}<div className="text-xs text-ink-muted">/{e.slug}</div></Td>
              <Td>{e.organiser ? <Link href={`/admin/editions/organisers/${e.organiser.id}`} className="hover:underline">{e.organiser.name}</Link> : ""}</Td>
              <Td><StatePill s={e.status} /></Td>
              <Td className="whitespace-nowrap text-ink-soft">{day(e.starts_on)} to {day(e.ends_on)}</Td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}

async function Entitlements({ state }: { state: string }) {
  const r = await entitlementRows();
  const rows = r.rows.filter((e) => !state || entitlementState(e) === state);
  return (
    <>
      <p className="mb-3 text-sm text-ink-muted">Manual package adjustments are an exception tool, for refunds and goodwill. Organisers normally choose and pay for their own package after approval.</p>
      <FilterLinks base={{ tab: "entitlements" }} param="state" current={state} options={[{ value: "", label: "All" }, { value: "live", label: "Live" }, { value: "expired", label: "Expired" }, { value: "voided", label: "Voided" }]} />
      {r.error ? <ErrorNote>{r.error}</ErrorNote> : !rows.length ? <Empty>No entitlements match.</Empty> : (
        <DataTable head={["Edition", "Feature", "State", "Window", "Source and reason"]}>
          {rows.map((e) => (
            <tr key={e.id}>
              <Td>{e.edition ? <Link href={`/admin/editions/${e.edition.id}`} className="font-bold text-navy hover:underline">{e.edition.title}</Link> : "Unknown"}<div className="text-xs text-ink-muted">{e.organiser?.name}</div></Td>
              <Td>{FEATURE_LABEL[e.feature] ?? e.feature}</Td>
              <Td><StatePill s={entitlementState(e)} /></Td>
              <Td className="whitespace-nowrap text-ink-soft">{day(e.starts_at)} to {day(e.ends_at)}</Td>
              <Td className="text-ink-soft">{e.source.replace("_", " ")}{e.amount_pence != null ? `, £${(e.amount_pence / 100).toFixed(2)}` : ""}{e.reason ? `: ${e.reason}` : ""}{e.void_reason ? ` (voided: ${e.void_reason})` : ""}</Td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}

async function Audit() {
  const r = await auditRows();
  if (r.error) return <ErrorNote>{r.error}</ErrorNote>;
  const who = await names(r.rows.map((x) => x.actor));
  return <><p className="mb-3 text-sm text-ink-muted">Latest 200 entries, newest first.</p><AuditList rows={r.rows} who={who} /></>;
}
