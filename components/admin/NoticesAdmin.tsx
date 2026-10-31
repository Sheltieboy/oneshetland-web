"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { approveFuneralNotice, enableNoticeImportSource, noticeRead, noticeWrite, revokeEssentialAlert } from "@/app/notices/actions";
import { Card, Empty, StatusPill } from "@/components/admin/AdminUI";
import { Field, Status, btnDanger, btnPrimary, btnQuiet, inputCls, useAction } from "@/components/notices/Fields";
import { CORRECTION_FIELDS, buildCorrection, formatNoticeDateTime } from "@/lib/notices-alerts";

/* Every control here calls a server action that runs on the signed-in admin's OWN session: the database authorises and its refusal is shown. */

const when = (v: unknown) => (typeof v === "string" && v ? formatNoticeDateTime(v) : "—");
const asS = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

/* ── Organisations & entitlement ───────────────────────────────────────────── */
export type OrgRow = { id: string; slug: string; name: string; kind: string; website_url: string | null; verified_at: string | null; is_active: boolean; import_source: string | null; members: number; has_essential_grant: boolean; granted_at: string | null };
type Member = { user_id: string; display_name: string | null; role: string; is_active: boolean; added_at: string; removed_at: string | null };

function OrgCard({ o }: { o: OrgRow }) {
  const router = useRouter();
  const act = useAction();
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [uid, setUid] = useState("");
  const [role, setRole] = useState("publisher");
  const done = (ok: boolean) => { if (ok) router.refresh(); };
  const loadMembers = async () => {
    const r = await act.run(() => noticeRead("admin_list_official_publisher_members", { p_publisher: o.id }), "");
    if (r.ok) setMembers(Array.isArray(r.data) ? (r.data as Member[]) : []);
  };
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0"><p className="font-display text-lg font-bold text-ink">{o.name}</p><p className="text-sm text-ink-muted">{o.slug} {"·"} {o.kind}{o.import_source ? ` · import: ${o.import_source}` : ""}</p></div>
        <div className="flex flex-wrap gap-1.5">
          <StatusPill label={o.verified_at ? "Verified" : "Not verified"} tone={o.verified_at ? "green" : "amber"} />
          <StatusPill label={o.is_active ? "Active" : "Inactive"} tone={o.is_active ? "blue" : "gray"} />
          <StatusPill label={o.has_essential_grant ? "Essential Alerts: on" : "Essential Alerts: off"} tone={o.has_essential_grant ? "red" : "gray"} />
        </div>
      </div>
      <p className="mt-2 text-sm text-ink-soft">{o.members} member{o.members === 1 ? "" : "s"}{o.granted_at ? ` · entitlement granted ${when(o.granted_at)}` : ""}</p>

      <div className="mt-3 space-y-3">
        {!o.verified_at && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[14rem] flex-1"><Field label="How was this organisation verified?" htmlFor={`vn${o.id}`}><input id={`vn${o.id}`} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. rang the published switchboard on ..." /></Field></div>
            <button type="button" className={btnPrimary} disabled={act.state.busy} onClick={async () => done((await act.run(() => noticeWrite("admin_verify_official_publisher", { p_publisher: o.id, p_note: note }), "Verified.")).ok)}>Verify</button>
          </div>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[14rem] flex-1"><Field label={o.has_essential_grant ? "Reason for revoking Essential Alerts" : "Reason for granting Essential Alerts"} htmlFor={`gr${o.id}`}><input id={`gr${o.id}`} className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} /></Field></div>
          {!o.has_essential_grant
            ? <button type="button" className={btnPrimary} disabled={act.state.busy || !o.verified_at} onClick={async () => done((await act.run(() => noticeWrite("admin_grant_essential_alert", { p_publisher: o.id, p_reason: reason }), "Entitlement granted.")).ok)}>Grant Essential Alerts</button>
            : <button type="button" className={btnDanger} disabled={act.state.busy} onClick={async () => {
                if (!window.confirm(`Revoke Essential Alerts for ${o.name}? Any of its live Essential Alerts will be demoted to ordinary notices straight away.`)) return;
                done((await act.run(() => revokeEssentialAlert(o.id, reason), "Revoked. Live alerts from this organisation have been demoted.")).ok);
              }}>Revoke (demotes live alerts)</button>}
          <button type="button" className={btnQuiet} disabled={act.state.busy} onClick={async () => done((await act.run(() => noticeWrite("admin_set_official_publisher_active", { p_publisher: o.id, p_active: !o.is_active }), o.is_active ? "Deactivated." : "Activated.")).ok)}>{o.is_active ? "Deactivate" : "Activate"}</button>
        </div>
        {!o.verified_at && <p className="text-xs text-ink-muted">The entitlement can only be granted to a verified, active organisation with at least one authorised publisher.</p>}

        <button type="button" className="text-sm font-semibold text-navy-light underline" onClick={() => { setOpen(!open); if (!open && !members) void loadMembers(); }}>{open ? "Hide members" : "Members"}</button>
        {open && (
          <div className="rounded-lg border border-line p-3">
            {members === null ? <p className="text-sm text-ink-muted">Loading{"…"}</p> : members.length === 0 ? <p className="text-sm text-ink-muted">No members yet.</p> : (
              <ul className="divide-y divide-line">{members.map((m) => (
                <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0 break-all"><strong>{m.display_name ?? "Member"}</strong> <span className="text-ink-muted">{m.user_id}</span> {"·"} {m.role} {"·"} {m.is_active ? "active" : "removed"}</span>
                  <button type="button" className={btnQuiet} disabled={act.state.busy} onClick={async () => { const r = await act.run(() => noticeWrite("admin_set_official_publisher_member", { p_publisher: o.id, p_user: m.user_id, p_role: m.role, p_active: !m.is_active }), "Updated."); if (r.ok) { await loadMembers(); router.refresh(); } }}>{m.is_active ? "Remove" : "Restore"}</button>
                </li>))}</ul>
            )}
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div className="min-w-[14rem] flex-1"><Field label="Add a member by user id" htmlFor={`mu${o.id}`}><input id={`mu${o.id}`} className={inputCls} value={uid} onChange={(e) => setUid(e.target.value)} placeholder="user uuid" /></Field></div>
              <select aria-label="Role" className={inputCls + " !w-auto"} value={role} onChange={(e) => setRole(e.target.value)}><option value="publisher">Publisher</option><option value="delegate">Delegate (cannot issue alerts)</option></select>
              <button type="button" className={btnPrimary} disabled={act.state.busy || !uid.trim()} onClick={async () => { const r = await act.run(() => noticeWrite("admin_set_official_publisher_member", { p_publisher: o.id, p_user: uid.trim(), p_role: role, p_active: true }), "Member saved."); if (r.ok) { setUid(""); await loadMembers(); router.refresh(); } }}>Add</button>
            </div>
          </div>
        )}
        <Status state={act.state} />
      </div>
    </Card>
  );
}

export function OrganisationsTab({ rows }: { rows: OrgRow[] }) {
  const router = useRouter();
  const act = useAction();
  const [f, setF] = useState({ slug: "", name: "", kind: "council", website: "", imp: "" });
  return (
    <div className="space-y-4">
      <Card>
        <h2 className="font-display text-lg font-bold text-ink">New organisation</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Name" htmlFor="on"><input id="on" className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Short code (lower case, hyphens)" htmlFor="os"><input id="os" className={inputCls} value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} /></Field>
          <Field label="Kind" htmlFor="ok"><select id="ok" className={inputCls} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{["council", "health", "utility", "transport", "emergency", "other"].map((k) => <option key={k}>{k}</option>)}</select></Field>
          <Field label="Website" optional htmlFor="ow"><input id="ow" className={inputCls} value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} placeholder="https://" /></Field>
          <Field label="Import source id" optional htmlFor="oi"><input id="oi" className={inputCls} value={f.imp} onChange={(e) => setF({ ...f, imp: e.target.value })} /></Field>
        </div>
        <div className="mt-3 space-y-2"><Status state={act.state} /><button type="button" className={btnPrimary} disabled={act.state.busy} onClick={async () => { const r = await act.run(() => noticeWrite("admin_upsert_official_publisher", { p_slug: f.slug.trim(), p_name: f.name.trim(), p_kind: f.kind, p_website_url: f.website.trim() || null, p_import_source: f.imp.trim() || null }), "Saved. It cannot publish until it is verified."); if (r.ok) { setF({ slug: "", name: "", kind: "council", website: "", imp: "" }); router.refresh(); } }}>Create</button></div>
      </Card>
      {rows.length === 0 ? <Empty>No organisations yet.</Empty> : rows.map((o) => <OrgCard key={o.id} o={o} />)}
    </div>
  );
}

/* ── Funeral moderation ────────────────────────────────────────────────────── */
export type FuneralRowAdmin = Record<string, unknown> & { id: string; status: string; full_name: string };
export type ChangeReq = { id: string; funeral_id: string; kind: string; message: string; contact: string | null; created_at: string };
const METHODS: [string, string][] = [["phone_callback", "Telephone call-back"], ["funeral_director_confirmation", "Funeral director confirmed"], ["in_person", "In person"], ["existing_notice_source", "Existing published notice"], ["other", "Other"]];
const TONE: Record<string, "green" | "amber" | "red" | "blue" | "gray"> = { submitted: "amber", in_review: "blue", needs_info: "amber", approved: "green", rejected: "red", withdrawn: "gray", taken_down: "gray" };

function FuneralItem({ r }: { r: FuneralRowAdmin }) {
  const router = useRouter();
  const act = useAction();
  const [note, setNote] = useState("");
  const [method, setMethod] = useState("");
  const status = r.status;
  const review = async (action: string) => { const x = await act.run(() => noticeWrite("admin_funeral_review", { p_id: r.id, p_action: action, p_note: note || null, p_verification_method: null }), "Done."); if (x.ok) router.refresh(); };
  const pending = ["submitted", "in_review", "needs_info"].includes(status);
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2"><p className="font-display text-lg font-bold text-ink">{r.full_name}</p><StatusPill label={status.replace("_", " ")} tone={TONE[status] ?? "gray"} /></div>
      <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        {[["Submitted", when(r.created_at)], ["Submitted by", `${asS(r.submitter_name)} (${asS(r.submitter_role)}${r.submitter_relationship ? `, ${asS(r.submitter_relationship)}` : ""})`], ["Phone", asS(r.submitter_phone) || "—"], ["Email", asS(r.submitter_email) || "—"], ["Died", asS(r.died_on) || "—"], ["Area", asS(r.area_id) || "—"], ["Publish arrangements", r.service_public ? "Yes" : "No"], ["Notification approved", r.announce_in_notifications ? (r.announce_name_in_preview ? "Yes, with name" : "Yes, no name") : "No"]].map(([k, v]) => <div key={k}><dt className="inline font-semibold text-ink-soft">{k}: </dt><dd className="inline break-words text-ink">{v}</dd></div>)}
      </dl>
      {r.announcement ? <p className="mt-2 whitespace-pre-line break-words text-sm text-ink-soft">{asS(r.announcement)}</p> : null}
      {r.review_message ? <p className="mt-2 text-sm text-amber-900">Message to submitter: {asS(r.review_message)}</p> : null}
      {pending && (
        <div className="mt-3 space-y-3">
          <Field label="Note" hint="Required to approve (how it was verified), to ask for information (what is needed), and to reject." htmlFor={`fn${r.id}`}><textarea id={`fn${r.id}`} rows={2} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <div className="flex flex-wrap items-center gap-2">
            {status !== "in_review" && <button type="button" className={btnQuiet} disabled={act.state.busy} onClick={() => review("start_review")}>Start review</button>}
            <button type="button" className={btnQuiet} disabled={act.state.busy} onClick={() => review("request_info")}>Ask for information</button>
            <select aria-label="Verification method" className={inputCls + " !w-auto"} value={method} onChange={(e) => setMethod(e.target.value)}><option value="">How verified{"…"}</option>{METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <button type="button" className={btnPrimary} disabled={act.state.busy} onClick={async () => { const x = await act.run(() => approveFuneralNotice(r.id, method, note), "Approved and published."); if (x.ok) router.refresh(); }}>Approve</button>
            <button type="button" className={btnDanger} disabled={act.state.busy} onClick={() => review("reject")}>Reject</button>
          </div>
        </div>
      )}
      {status === "approved" && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[14rem] flex-1"><Field label="Reason for taking down" htmlFor={`td${r.id}`}><input id={`td${r.id}`} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field></div>
          <button type="button" className={btnDanger} disabled={act.state.busy || !note.trim()} onClick={async () => { if (!window.confirm("Take this announcement down now?")) return; const x = await act.run(() => noticeWrite("admin_funeral_takedown", { p_id: r.id, p_reason: note }), "Taken down."); if (x.ok) router.refresh(); }}>Take down</button>
        </div>
      )}
      <div className="mt-2"><Status state={act.state} /></div>
    </Card>
  );
}

function ChangeItem({ c }: { c: ChangeReq }) {
  const router = useRouter();
  const act = useAction();
  const [note, setNote] = useState("");
  const [corr, setCorr] = useState<Record<string, string>>({});
  const resolve = async (outcome: "actioned" | "declined") => { const x = await act.run(() => noticeWrite("admin_funeral_resolve_change", { p_request: c.id, p_outcome: outcome, p_note: note || null, p_correction: outcome === "actioned" && c.kind === "correction" ? buildCorrection(corr) : null }), outcome === "actioned" ? "Actioned." : "Declined."); if (x.ok) router.refresh(); };
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2"><StatusPill label={c.kind === "takedown" ? "Takedown request" : "Correction request"} tone={c.kind === "takedown" ? "red" : "amber"} /><span className="text-xs text-ink-muted">{when(c.created_at)}</span></div>
      <p className="mt-2 whitespace-pre-line break-words text-sm text-ink">{c.message}</p>
      <p className="mt-1 text-xs text-ink-muted">Notice {c.funeral_id}{c.contact ? ` · contact: ${c.contact}` : ""}</p>
      <div className="mt-3"><Field label="Outcome note" htmlFor={`cn${c.id}`}><input id={`cn${c.id}`} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field></div>
      {c.kind === "correction" && (
        <fieldset className="mt-3 space-y-2 rounded-lg border border-line p-3">
          <legend className="px-1 text-sm font-semibold text-ink">Correction (fill in only what changes)</legend>
          {CORRECTION_FIELDS.map(([k, label]) => (
            <Field key={k} label={label} htmlFor={`cf${c.id}${k}`}>
              {k === "service_at" ? <input id={`cf${c.id}${k}`} type="datetime-local" className={inputCls} value={corr[k] ?? ""} onChange={(e) => setCorr({ ...corr, [k]: e.target.value })} />
                : <textarea id={`cf${c.id}${k}`} rows={k === "announcement" ? 3 : 1} className={inputCls} value={corr[k] ?? ""} onChange={(e) => setCorr({ ...corr, [k]: e.target.value })} />}
            </Field>
          ))}
        </fieldset>
      )}
      <p className="mt-1 text-xs text-ink-muted">Actioning a takedown removes the announcement. Fields left blank are not changed; "Mark actioned" applies any you filled in.</p>
      <div className="mt-2 flex gap-2"><button type="button" className={btnPrimary} disabled={act.state.busy} onClick={() => resolve("actioned")}>Mark actioned</button><button type="button" className={btnQuiet} disabled={act.state.busy} onClick={() => resolve("declined")}>Decline</button></div>
      <div className="mt-2"><Status state={act.state} /></div>
    </Card>
  );
}

export function FuneralTab({ rows, changes, status, basePath }: { rows: FuneralRowAdmin[]; changes: ChangeReq[]; status: string; basePath: string }) {
  const filters = ["", "submitted", "in_review", "needs_info", "approved", "rejected", "withdrawn", "taken_down"];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {filters.map((s) => <a key={s || "all"} href={`${basePath}${basePath.includes("?") ? "&" : "?"}status=${s}`} className={"inline-flex min-h-[44px] items-center rounded-pill px-4 text-sm font-semibold " + (status === s ? "bg-navy text-paper" : "border border-line-strong text-ink-soft hover:bg-sand")}>{s ? s.replace("_", " ") : "All"}</a>)}
      </div>
      <section aria-label="Change requests" className="space-y-3">
        <h2 className="font-display text-xl font-bold text-ink">Open change requests ({changes.length})</h2>
        {changes.length === 0 ? <Empty>No open requests.</Empty> : changes.map((c) => <ChangeItem key={c.id} c={c} />)}
      </section>
      <section aria-label="Queue" className="space-y-3">
        <h2 className="font-display text-xl font-bold text-ink">Announcements ({rows.length})</h2>
        {rows.length === 0 ? <Empty>Nothing here.</Empty> : rows.map((r) => <FuneralItem key={r.id} r={r} />)}
      </section>
    </div>
  );
}

/* ── Notice status management ──────────────────────────────────────────────── */
export type NoticeRowAdmin = { id: string; title: string; status: string; published_at: string | null; expires_at: string | null; category: string | null; is_essential: boolean | null; source: string | null };
export function StatusTab({ rows, status }: { rows: NoticeRowAdmin[]; status: string }) {
  const router = useRouter();
  const act = useAction();
  const filters = ["", "pending", "published", "resolved", "withdrawn"];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {filters.map((s) => <a key={s || "all"} href={`/admin/notices?tab=status&status=${s}`} className={"inline-flex min-h-[44px] items-center rounded-pill px-4 text-sm font-semibold " + (status === s ? "bg-navy text-paper" : "border border-line-strong text-ink-soft hover:bg-sand")}>{s || "All"}</a>)}
      </div>
      <Status state={act.state} />
      {rows.length === 0 ? <Empty>No notices.</Empty> : (
        <ul className="space-y-2">{rows.map((n) => (
          <li key={n.id} className="rounded-xl border border-line bg-paper p-3 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="min-w-0 break-words font-semibold text-ink">{n.title}</p><StatusPill label={n.status} tone={n.status === "published" ? "green" : n.status === "pending" ? "amber" : "gray"} /></div>
            <p className="mt-0.5 text-xs text-ink-muted">{n.is_essential ? "Essential · " : ""}{n.source ? `import: ${n.source} · ` : ""}{n.category ?? "no category"} {"·"} {when(n.published_at)} {"→"} {when(n.expires_at)} {"·"} <span className="break-all">{n.id}</span></p>
            <div className="mt-2 flex flex-wrap gap-2">{(["published", "resolved", "withdrawn"] as const).filter((s) => s !== n.status).map((s) => <button key={s} type="button" className={s === "withdrawn" ? btnDanger : btnQuiet} disabled={act.state.busy} onClick={async () => { const x = await act.run(() => noticeWrite("manage_set_notice_status", { p_notice: n.id, p_status: s }), `Set to ${s}.`); if (x.ok) router.refresh(); }}>{s === "published" ? "Publish" : s === "resolved" ? "Resolve" : "Withdraw"}</button>)}</div>
          </li>))}</ul>
      )}
    </div>
  );
}

/* ── Imports (read-only status; enabling is a deliberate act) ──────────────── */
export type ImportRow = { id: string; label: string; is_enabled: boolean; retired_at: string | null; last_run_at: string | null; last_success_at: string | null; consecutive_failures: number; live_items: number | string; last_status: string | null; last_error: string | null };
function ImportItem({ s }: { s: ImportRow }) {
  const router = useRouter();
  const act = useAction();
  const [note, setNote] = useState("");
  const [arm, setArm] = useState(false);
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-display text-lg font-bold text-ink">{s.label}</p><p className="text-sm text-ink-muted">{s.id}</p></div>
        <div className="flex gap-1.5"><StatusPill label={s.retired_at ? "Retired" : s.is_enabled ? "Enabled" : "Disabled"} tone={s.retired_at ? "gray" : s.is_enabled ? "green" : "amber"} />{s.consecutive_failures > 0 && <StatusPill label={`${s.consecutive_failures} failure${s.consecutive_failures === 1 ? "" : "s"}`} tone="red" />}</div></div>
      <p className="mt-2 text-sm text-ink-soft">Live items: {String(s.live_items)} {"·"} last run {when(s.last_run_at)} ({s.last_status ?? "never"}) {"·"} last success {when(s.last_success_at)}</p>
      {s.last_error && <p className="mt-1 break-words text-sm text-rose-800">Last error: {s.last_error}</p>}
      {!s.retired_at && !s.is_enabled && (
        <div className="mt-3 space-y-2">
          {!arm ? <button type="button" className={btnQuiet} onClick={() => setArm(true)}>Enable this source{"…"}</button> : (
            <>
              <Field label="How were this source's reuse conditions confirmed?" hint="Required. Enabling starts publishing this source's items to the public." htmlFor={`ri${s.id}`}><textarea id={`ri${s.id}`} rows={2} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
              <div className="flex gap-2"><button type="button" className={btnPrimary} disabled={act.state.busy} onClick={async () => { const x = await act.run(() => enableNoticeImportSource(s.id, note), "Enabled."); if (x.ok) router.refresh(); }}>Confirm and enable</button><button type="button" className={btnQuiet} onClick={() => setArm(false)}>Cancel</button></div>
            </>
          )}
        </div>
      )}
      {s.is_enabled && !s.retired_at && <div className="mt-3"><button type="button" className={btnQuiet} disabled={act.state.busy} onClick={async () => { const x = await act.run(() => noticeWrite("admin_set_import_source_enabled", { p_id: s.id, p_enabled: false, p_reuse_note: null }), "Disabled."); if (x.ok) router.refresh(); }}>Disable</button></div>}
      <div className="mt-2"><Status state={act.state} /></div>
    </Card>
  );
}
export function ImportsTab({ rows }: { rows: ImportRow[] }) {
  return <div className="space-y-4">{rows.length === 0 ? <Empty>No import sources.</Empty> : rows.map((s) => <ImportItem key={s.id} s={s} />)}</div>;
}

/* ── Audit log & dispatch history ──────────────────────────────────────────── */
export type AuditRow = { id: number; at: string; actor_id: string | null; actor_role: string | null; event: string; publisher_id: string | null; notice_id: string | null; funeral_id: string | null; details: Record<string, unknown> };
export function AuditTab({ rows, nextBefore }: { rows: AuditRow[]; nextBefore: string | null }) {
  return (
    <div className="space-y-3">
      {rows.length === 0 ? <Empty>No audit entries.</Empty> : (
        <div className="overflow-x-auto rounded-xl border border-line bg-paper"><table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="bg-sand text-xs uppercase tracking-wider text-ink-muted"><tr><th className="px-3 py-2">When</th><th className="px-3 py-2">Event</th><th className="px-3 py-2">By</th><th className="px-3 py-2">About</th><th className="px-3 py-2">Details</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id} className="border-t border-line align-top"><td className="whitespace-nowrap px-3 py-2">{when(r.at)}</td><td className="px-3 py-2 font-semibold">{r.event.replace(/_/g, " ")}</td><td className="px-3 py-2">{r.actor_role ?? "system"}</td><td className="break-all px-3 py-2 text-xs text-ink-muted">{r.notice_id ?? r.funeral_id ?? r.publisher_id ?? ""}</td><td className="break-words px-3 py-2 text-xs text-ink-soft">{Object.entries(r.details ?? {}).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join("; ")}</td></tr>)}</tbody>
        </table></div>
      )}
      {nextBefore && <a href={`/admin/notices?tab=audit&before=${encodeURIComponent(nextBefore)}`} className={btnQuiet}>Older entries</a>}
    </div>
  );
}

type Dispatch = { kind: string; status: string; claimed_at: string; completed_at: string | null; recipients: number | null; sent: number | null; held: number | null; failed: number | null; error: string | null };
export function DispatchTab({ initialId }: { initialId: string }) {
  const act = useAction();
  const [id, setId] = useState(initialId);
  const [rows, setRows] = useState<Dispatch[] | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[16rem] flex-1"><Field label="Notice id" htmlFor="di"><input id="di" className={inputCls} value={id} onChange={(e) => setId(e.target.value)} placeholder="notice uuid" /></Field></div>
        <button type="button" className={btnPrimary} disabled={act.state.busy || !id.trim()} onClick={async () => { const r = await act.run(() => noticeRead("admin_notice_dispatch_history", { p_notice: id.trim() }), ""); if (r.ok) setRows(Array.isArray(r.data) ? (r.data as Dispatch[]) : []); }}>Look up</button>
      </div>
      <Status state={act.state} />
      {rows && (rows.length === 0 ? <Empty>No notification has been requested for this notice.</Empty> : (
        <ul className="space-y-2">{rows.map((d, i) => <li key={i} className="rounded-xl border border-line bg-paper p-3 text-sm"><p className="font-semibold">{d.kind} {"·"} {d.status}</p><p className="text-ink-soft">Claimed {when(d.claimed_at)}{d.completed_at ? ` · completed ${when(d.completed_at)}` : ""}</p><p className="text-ink-soft">Recipients {d.recipients ?? "—"} {"·"} sent {d.sent ?? "—"} {"·"} held (quiet hours / settings) {d.held ?? "—"} {"·"} failed {d.failed ?? "—"}</p>{d.error && <p className="text-rose-800">{d.error}</p>}</li>)}</ul>
      ))}
    </div>
  );
}
