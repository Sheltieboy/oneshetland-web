"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, StatusPill } from "@/components/admin/AdminUI";
import { useConfirm, useNotify } from "@/components/ui/ConfirmProvider";
import { dbMessage } from "@/lib/launch-grant";
import { CATEGORY_LABEL, queueHealth, type QueueStatus } from "@/lib/activities";

export type AdminActivity = {
  id: string; slug: string; title: string; category: string; status: "draft" | "published" | "ended"; admin_paused: boolean; admin_pause_reason: string | null;
  calendar_approved: boolean; owner_kind: "business" | "hub" | "platform"; owner_id: string | null; owner_name: string;
};
type Pick = { id: string; name: string };
const input = "w-full rounded-lg border border-line-strong bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-rose-300";

/**
 * Staff controls for Regular Activities: pause or resume any listing, approve a hub's activity, and hand an activity to a hub or a business.
 * Every rule (staff only, a reason, the audit log) lives in the database; this collects inputs, asks first and reports what the database said.
 */
export function ActivitiesAdmin({ rows, queue = null }: { rows: AdminActivity[]; queue?: QueueStatus | null }) {
  const router = useRouter();
  const confirm = useConfirm();
  const notify = useNotify();
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<{ id: string; mode: "pause" | "handover" } | null>(null);
  const [reason, setReason] = useState("");
  const [kind, setKind] = useState<"hub" | "business">("hub");
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Pick[] | null>(null);
  const [pick, setPick] = useState<Pick | null>(null);
  const sb = () => createClient();

  async function act(id: string, label: string, fn: () => PromiseLike<{ error: unknown }>, done: string) {
    setBusy(id);
    try { const { error } = await fn(); if (error) throw error; notify({ title: done, body: label, tone: "info" }); setOpen(null); setReason(""); setPick(null); setFound(null); setQ(""); router.refresh(); }
    catch (e) { notify({ title: "Couldn't save", body: dbMessage(e), tone: "error" }); } finally { setBusy(null); }
  }
  async function pause(a: AdminActivity, paused: boolean) {
    if (!(await confirm({ title: paused ? "Pause this activity?" : "Resume this activity?", body: paused ? `${a.title}\n\nIt disappears from What's On. The organiser still sees it, with your reason.` : `${a.title}\n\nIt shows publicly again.`, confirmLabel: paused ? "Pause" : "Resume", danger: paused }))) return;
    await act(a.id, a.title, () => sb().rpc("admin_set_activity_paused", { p_activity_id: a.id, p_paused: paused, p_reason: paused ? reason : null }), paused ? "Paused" : "Resumed");
  }
  async function search() {
    setFound(null);
    if (q.trim().length < 3) return;
    if (kind === "hub") {
      const { data } = await sb().from("hubs").select("id, name").ilike("name", `%${q.trim()}%`).limit(8);
      setFound((data ?? []) as Pick[]);
    } else {
      const { data } = await sb().rpc("admin_launch_business_lookup", { p_query: q.trim() });
      setFound(((data ?? []) as { business_id: string; name: string }[]).slice(0, 8).map((r) => ({ id: r.business_id, name: r.name })));
    }
  }
  async function handover(a: AdminActivity) {
    if (!pick) return;
    if (!(await confirm({ title: "Hand this activity over?", body: `${a.title}\n\nFrom ${a.owner_name} to ${pick.name} (${kind}). They will control it; you will not. This is recorded.`, confirmLabel: "Hand over" }))) return;
    await act(a.id, a.title, () => sb().rpc("admin_assign_activity_owner", { p_activity_id: a.id, p_business_id: kind === "business" ? pick.id : null, p_hub_id: kind === "hub" ? pick.id : null, p_reason: reason }), "Handed over");
  }
  async function approve(a: AdminActivity) {
    await act(a.id, a.title, () => sb().from("regular_activities").update({ calendar_approved: true }).eq("id", a.id), "Approved");
  }

  const health = queueHealth(queue, new Date().getTime());
  return (
    <>
    <Card className="mb-5">
      <h2 className="font-display text-lg font-bold text-ink">Follower alerts</h2>
      <p className="mt-1 text-sm text-ink-soft">Cancellations and changes go to followers&apos; OneShetland notifications only (no email or phone alerts yet). The job runs every minute.</p>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-sm"><StatusPill label={health.tone === "green" ? "healthy" : health.tone === "gray" ? "idle" : health.tone === "amber" ? "retrying" : "needs a look"} tone={health.tone} /> <span className="text-ink">{health.text}</span></p>
      {queue && <p className="mt-1 text-xs text-ink-muted">{queue.followers} follows in total · {queue.delivered_7d} delivered in 7 days · last run {queue.last_run ? new Date(queue.last_run).toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "never"}{queue.last_error ? ` · last error: ${queue.last_error}` : ""}</p>}
    </Card>
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-ink">All regular activities</h2>
        <Link href="/admin/activities/new" className="rounded-pill bg-navy px-5 py-2 text-sm font-semibold text-white">+ New platform activity</Link>
      </div>
      {rows.length === 0 ? <p className="mt-3 text-sm text-ink-muted">None yet.</p> : (
        <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
          {rows.map((a) => (
            <li key={a.id} className="px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{a.title} <span className="font-normal text-ink-muted">· {CATEGORY_LABEL[a.category] ?? a.category}</span></p>
                  <p className="text-xs text-ink-muted">{a.owner_kind === "platform" ? "OneShetland (platform)" : `${a.owner_kind === "hub" ? "Hub" : "Business"}: ${a.owner_name}`}{a.admin_paused && a.admin_pause_reason ? ` · paused: ${a.admin_pause_reason}` : ""}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill label={a.admin_paused ? "paused" : a.status} tone={a.admin_paused ? "red" : a.status === "published" ? "green" : "gray"} />
                  {a.owner_kind === "hub" && !a.calendar_approved && <StatusPill label="awaiting approval" tone="amber" />}
                  <Link href={`/whats-on/regular/${a.slug}`} className="text-xs font-semibold underline">View</Link>
                  {a.owner_kind === "platform" && <Link href={`/admin/activities/${a.id}`} className="text-xs font-semibold underline">Edit</Link>}
                  {a.owner_kind === "hub" && !a.calendar_approved && <button disabled={busy === a.id} onClick={() => void approve(a)} className="text-xs font-bold underline">Approve</button>}
                  {a.admin_paused ? <button disabled={busy === a.id} onClick={() => void pause(a, false)} className="text-xs font-bold underline">Resume</button> : <button onClick={() => setOpen({ id: a.id, mode: "pause" })} className="text-xs font-bold text-rose-700 underline">Pause</button>}
                  <button onClick={() => setOpen({ id: a.id, mode: "handover" })} className="text-xs font-bold underline">Hand over</button>
                </div>
              </div>
              {open?.id === a.id && open.mode === "pause" && (
                <div className="mt-2 rounded-lg bg-sand/60 p-3">
                  <label className="text-xs font-semibold text-ink" htmlFor={`pr-${a.id}`}>Why? (5+ characters; the organiser sees this)</label>
                  <input id={`pr-${a.id}`} className={input + " mt-1"} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
                  <button disabled={busy === a.id || reason.trim().length < 5} onClick={() => void pause(a, true)} className="mt-2 rounded-pill bg-rose-700 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40">Pause</button>
                </div>
              )}
              {open?.id === a.id && open.mode === "handover" && (
                <div className="mt-2 space-y-2 rounded-lg bg-sand/60 p-3">
                  <div className="flex flex-wrap gap-3 text-sm">{(["hub", "business"] as const).map((k) => <label key={k} className="flex items-center gap-1.5"><input type="radio" checked={kind === k} onChange={() => { setKind(k); setFound(null); setPick(null); }} /> To a {k}</label>)}</div>
                  <div className="flex gap-2"><input className={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name (3+ letters)" aria-label="Find the new owner" /><button onClick={() => void search()} className="rounded-pill border border-line-strong px-4 py-1.5 text-sm font-semibold">Search</button></div>
                  {found && found.length === 0 && <p className="text-xs text-ink-muted">No match.</p>}
                  {found && found.length > 0 && <ul className="space-y-1">{found.map((f) => <li key={f.id}><button onClick={() => setPick(f)} className={"w-full rounded-lg border px-3 py-1.5 text-left text-sm " + (pick?.id === f.id ? "border-navy bg-white font-semibold" : "border-line")}>{f.name}</button></li>)}</ul>}
                  <label className="block text-xs font-semibold text-ink" htmlFor={`hr-${a.id}`}>Why? (10+ characters, recorded)</label>
                  <input id={`hr-${a.id}`} className={input} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
                  <button disabled={busy === a.id || !pick || reason.trim().length < 10} onClick={() => void handover(a)} className="rounded-pill bg-navy px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40">Hand over</button>
                  <p className="text-xs text-ink-muted">A hub&apos;s activity shows publicly once the hub is verified or you approve it.</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
    </>
  );
}
