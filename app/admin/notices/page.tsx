import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { callRpc } from "@/lib/notices-rpc";
import { AdminHeader } from "@/components/admin/AdminUI";
import { Notice } from "@/components/notices/NoticesShell";
import {
  AuditTab, DispatchTab, FuneralTab, ImportsTab, OrganisationsTab, PrivacyTab, StatusTab,
  type AuditRow, type ChangeReq, type FuneralRowAdmin, type ImportRow, type NoticeRowAdmin, type OrgRow, type RedactionCandidate, type RetentionRow,
} from "@/components/admin/NoticesAdmin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notices & alerts" };

const TABS = [["orgs", "Organisations"], ["funeral", "Funeral moderation"], ["status", "Notice status"], ["imports", "Imports"], ["audit", "Audit log"], ["privacy", "Privacy"], ["dispatch", "Dispatch history"]] as const;
type Tab = (typeof TABS)[number][0];
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/**
 * Admin -> Notices & alerts. (The /admin layout already requires a platform administrator.) Every read here runs on the signed-in admin's own session,
 * so the database decides what they may see; a refusal is shown, never hidden. Moderators, who cannot enter /admin, use /notices/moderate (funeral only).
 */
export default async function AdminNotices({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const tab: Tab = (TABS.map((t) => t[0]) as string[]).includes(one(sp.tab)) ? (one(sp.tab) as Tab) : "orgs";
  const sb = await createClient();
  const status = one(sp.status);
  let body: React.ReactNode = null;

  if (tab === "orgs") {
    const r = await callRpc<OrgRow[]>(sb, "admin_list_official_publishers");
    body = r.ok ? <OrganisationsTab rows={Array.isArray(r.data) ? r.data : []} /> : <Notice tone="error">{r.error}</Notice>;
  } else if (tab === "funeral") {
    const [q, c] = await Promise.all([callRpc<FuneralRowAdmin[]>(sb, "admin_funeral_queue", { p_status: status || null }), callRpc<ChangeReq[]>(sb, "admin_funeral_change_requests")]);
    body = !q.ok ? <Notice tone="error">{q.error}</Notice> : <FuneralTab rows={Array.isArray(q.data) ? q.data : []} changes={c.ok && Array.isArray(c.data) ? c.data : []} status={status} basePath="/admin/notices?tab=funeral" />;
  } else if (tab === "status") {
    const r = await callRpc<NoticeRowAdmin[]>(sb, "manage_notices", { p_scope: "all", p_id: null, p_status: status || null, p_limit: 100 });
    body = r.ok ? <StatusTab rows={Array.isArray(r.data) ? r.data : []} status={status} /> : <Notice tone="error">{r.error}</Notice>;
  } else if (tab === "imports") {
    const r = await callRpc<ImportRow[]>(sb, "admin_import_status");
    body = r.ok ? <ImportsTab rows={Array.isArray(r.data) ? r.data : []} /> : <Notice tone="error">{r.error}</Notice>;
  } else if (tab === "audit") {
    const before = one(sp.before);
    const r = await callRpc<AuditRow[]>(sb, "admin_notice_audit", { p_limit: 100, p_before: before || null });
    const rows = r.ok && Array.isArray(r.data) ? r.data : [];
    body = r.ok ? <AuditTab rows={rows} nextBefore={rows.length === 100 ? rows[rows.length - 1].at : null} /> : <Notice tone="error">{r.error}</Notice>;
  } else if (tab === "privacy") {
    const [ret, cand] = await Promise.all([callRpc<RetentionRow[]>(sb, "admin_funeral_retention_report"), callRpc<RedactionCandidate[]>(sb, "admin_audit_redaction_candidates", { p_months: 12 })]);
    body = !ret.ok ? <Notice tone="error">{ret.error}</Notice> : <PrivacyTab retention={Array.isArray(ret.data) ? ret.data : []} candidates={cand.ok && Array.isArray(cand.data) ? cand.data : []} />;
  } else {
    body = <DispatchTab initialId={one(sp.notice)} />;
  }

  return (
    <>
      <AdminHeader title="Notices & alerts" sub="Organisations and entitlement, funeral moderation, notice status, imports, audit, privacy and notification history." />
      <nav aria-label="Sections" className="-mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-1">
        {TABS.map(([k, label]) => <Link key={k} href={`/admin/notices?tab=${k}`} aria-current={tab === k ? "page" : undefined} className={"inline-flex min-h-[44px] shrink-0 items-center rounded-pill px-4 text-sm font-semibold " + (tab === k ? "bg-rose-600 text-white" : "border border-line-strong text-ink-soft hover:bg-sand")}>{label}</Link>)}
      </nav>
      {body}
    </>
  );
}
