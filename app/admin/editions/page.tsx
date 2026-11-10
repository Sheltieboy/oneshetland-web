import Link from "next/link";
import { AdminHeader, Empty } from "@/components/admin/AdminUI";
import { AuditList, DataTable, EditionsTabs, ErrorNote, Facts, FilterLinks, ReservedPill, StatePill, TestPill, Td, day, when } from "@/components/admin/EditionsAdminParts";
import { FEATURE_LABEL, entitlementState, one, parseTab } from "./helpers";
import { auditRows, editionRows, entitlementRows, names, organiserRows, queueRows } from "./queries";
import { HubSetupForm, HubVerifyForm, PilotSwitchForm } from "@/components/admin/EditionsAdminForms";
import { Section } from "@/components/admin/EditionsAdminParts";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Editions · Admin" };

/** Admin → Editions. Reads run as the signed-in administrator (RLS); the layout already requires an administrator. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const tab = parseTab(sp.tab);
  const status = one(sp.status), test = one(sp.test), ent = one(sp.state);
  const queue = await queueRows();

  return (
    <>
      <AdminHeader title="Editions" sub="Verify organisers, moderate Editions, manage entitlements and read the audit trail." />
      <EditionsTabs active={tab} queueCount={queue.rows.length} />
      {tab === "queue" && <Queue q={queue} />}
      {tab === "organisers" && <Organisers status={status} />}
      {tab === "editions" && <Editions status={status} test={test} />}
      {tab === "entitlements" && <Entitlements state={ent} />}
      {tab === "pilot" && <Pilot />}
      {tab === "audit" && <Audit />}
    </>
  );
}

async function Queue({ q }: { q: Awaited<ReturnType<typeof queueRows>> }) {
  if (q.error) return <ErrorNote>{q.error}</ErrorNote>;
  if (!q.rows.length) return <Empty>No verification requests are waiting.</Empty>;
  const who = await names(q.rows.map((r) => r.requested_by));
  return (
    <>
      <p className="mb-3 text-sm text-ink-muted">Oldest first. Open a request to read the evidence and decide.</p>
      <ul className="space-y-3">
        {q.rows.map((r) => (
          <li key={r.id} className={"rounded-card border bg-paper p-4 shadow-soft " + (r.organiser?.reserved_name_flag ? "border-amber-500" : "border-line")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-lg font-bold text-ink">{r.organiser?.name ?? "Unknown organiser"}</h2>
                {r.organiser?.reserved_name_flag && <ReservedPill />}
                {r.organiser?.is_test && <TestPill />}
              </div>
              <span className="text-xs text-ink-muted">Requested {when(r.created_at)} by {r.requested_by ? who[r.requested_by] ?? "a user" : "unknown"}</span>
            </div>
            <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm text-ink-soft">{r.evidence}</p>
            <Link href={`/admin/editions/organisers/${r.organiser_id}`} className="mt-3 inline-flex min-h-11 items-center rounded-pill bg-navy px-5 text-sm font-bold text-white hover:bg-navy-dark">Review and decide</Link>
          </li>
        ))}
      </ul>
    </>
  );
}

async function Organisers({ status }: { status: string }) {
  const r = await organiserRows(status);
  return (
    <>
      <FilterLinks base={{ tab: "organisers" }} param="status" current={status} options={[{ value: "", label: "All" }, ...["pending", "verified", "rejected", "suspended"].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }))]} />
      {r.error ? <ErrorNote>{r.error}</ErrorNote> : !r.rows.length ? <Empty>No organisers match.</Empty> : (
        <DataTable head={["Organiser", "Status", "Contact", "Created"]}>
          {r.rows.map((o) => (
            <tr key={o.id}>
              <Td><Link href={`/admin/editions/organisers/${o.id}`} className="font-bold text-navy hover:underline">{o.name}</Link> <span className="text-ink-muted">/{o.slug}</span>
                <div className="mt-1 flex gap-1">{o.reserved_name_flag && <ReservedPill />}{o.is_test && <TestPill />}</div></Td>
              <Td><StatePill s={o.status} /></Td>
              <Td className="break-all text-ink-soft">{o.contact_email}</Td>
              <Td className="whitespace-nowrap text-ink-muted">{day(o.created_at)}</Td>
            </tr>
          ))}
        </DataTable>
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

async function Pilot() {
  const sb = await createClient();
  const [cfg, appr, hubsRes] = await Promise.all([
    sb.from("admin_config").select("key, value").in("key", ["editions.enabled", "editions.pilot"]),
    sb.from("edition_pilot_approvals").select("id, organiser_id, approved_at, note").is("revoked_at", null).order("approved_at", { ascending: false }),
    sb.from("hubs").select("id, name, slug, is_active, is_verified").eq("is_active", true).order("name").limit(60),
  ]);
  const hubs = (hubsRes.data ?? []) as { id: string; name: string; slug: string | null; is_active: boolean; is_verified: boolean | null }[];
  const val = (k: string) => String(((cfg.data ?? []) as { key: string; value: string }[]).find((c) => c.key === k)?.value ?? "").trim().toLowerCase() === "true";
  const open = val("editions.enabled"), pilotOn = val("editions.pilot");
  const rows = (appr.data ?? []) as { id: string; organiser_id: string; approved_at: string; note: string }[];
  const orgs = rows.length ? (((await sb.from("edition_organisers").select("id, name, slug, status, hub_id").in("id", rows.map((r) => r.organiser_id))).data ?? []) as { id: string; name: string; slug: string; status: string; hub_id: string | null }[]) : [];
  const orgById = new Map(orgs.map((o) => [o.id, o]));
  return (
    <>
      <Section title="Where Editions stands">
        <Facts rows={[["Open to everyone (editions.enabled)", open ? "ON: any verified, published, entitled Edition is public and anyone can register an organiser" : "Off"], ["Pilot switch (editions.pilot)", pilotOn ? "ON: only organisers listed below are public" : "Off: nothing is public through the pilot"], ["Payments", "Disabled: they need the open flag as well as the commerce flag, and pilot access never turns either on"]]} />
        {open && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-900">Editions is open to everyone. The pilot has no effect while that is on.</p>}
      </Section>
      <Section title="Pilot switch"><p className="mb-2 text-sm text-ink-soft">Switching the pilot on exposes nothing by itself. An organiser is public only when it is approved below, verified, its Hub (if any) is active and verified, and an Edition is published with a live publish entitlement. Switching it off removes public access at once; teams keep authoring.</p><PilotSwitchForm on={pilotOn} /></Section>
      <Section title="Approved for the pilot">
        {!rows.length ? <p className="text-sm text-ink-muted">No organiser is approved. Approve one from its organiser page.</p> : (
          <DataTable head={["Organiser", "Approved", "Note"]}>{rows.map((r) => { const o = orgById.get(r.organiser_id); return (
            <tr key={r.id}><Td>{o ? <Link href={`/admin/editions/organisers/${o.id}`} className="font-bold text-navy hover:underline">{o.name}</Link> : "Unknown"}{o ? <span className="text-ink-muted"> /{o.slug}</span> : null}</Td><Td className="whitespace-nowrap text-ink-muted">{when(r.approved_at)}</Td><Td className="text-ink-soft">{r.note}</Td></tr>); })}
          </DataTable>
        )}
      </Section>
      <Section title="Verify a Hub">
        <p className="mb-3 text-sm text-ink-soft">A Hub must be verified before it can be approved for the pilot. Verification is a trust label used across OneShetland: a verified Hub&apos;s islands-wide events are calendar-approved without review. Only verify a Hub whose committee you have checked. Every change is recorded in the audit log.</p>
        {!hubs.length ? <p className="text-sm text-ink-muted">No active Hubs.</p> : (
          <ul className="space-y-3">{hubs.map((h) => (
            <li key={h.id} className="rounded-lg border border-line p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2"><span className="font-bold text-ink">{h.name}</span>{h.slug && <span className="text-xs text-ink-muted">/{h.slug}</span>}<span className={"rounded-pill px-2 py-0.5 text-xs font-bold " + (h.is_verified ? "bg-emerald-100 text-emerald-900" : "bg-sand text-ink-soft")}>{h.is_verified ? "Verified" : "Not verified"}</span><span className="text-xs text-ink-muted break-all">{h.id}</span></div>
              <HubVerifyForm hubId={h.id} verified={!!h.is_verified} />
            </li>))}
          </ul>
        )}
      </Section>
      <Section title="Set up Editions for a Hub"><p className="mb-2 text-sm text-ink-soft">Creates the verified organiser for an active Hub, run by that Hub&apos;s own owner and committee. It does not approve the pilot. The Hub itself must be verified separately before it can be approved.</p><HubSetupForm /></Section>
    </>
  );
}
