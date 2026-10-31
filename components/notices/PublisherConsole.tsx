"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { noticeWrite, notifyNoticeAudience } from "@/app/notices/actions";
import {
  NOTICE_CATEGORIES, SHETLAND_WIDE, formatNoticeDateTime, officialPublishArgs, validateOfficialNotice,
  type FieldErrors, type NoticeCardModel, type OfficialNoticeInput,
} from "@/lib/notices-alerts";
import { Check, Field, Status, btnDanger, btnPrimary, btnQuiet, inputCls, localToDate, useAction } from "@/components/notices/Fields";

export type MyPublisher = { publisher_id: string; slug: string; name: string; kind: string; role: string; can_publish: boolean; can_essential: boolean };
type Area = { id: string; name: string };

type Form = { title: string; body: string; actionText: string; category: string; areaIds: string[]; startsAt: string; expiresAt: string; reviewAt: string; linkUrl: string; essential: boolean };
const EMPTY: Form = { title: "", body: "", actionText: "", category: "", areaIds: [], startsAt: "", expiresAt: "", reviewAt: "", linkUrl: "", essential: false };

/** datetime-local value for an ISO instant, in the viewer's zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const asInput = (f: Form): OfficialNoticeInput => ({ title: f.title, body: f.body, actionText: f.actionText, category: f.category, areaIds: f.areaIds, startsAt: localToDate(f.startsAt), expiresAt: localToDate(f.expiresAt), reviewAt: localToDate(f.reviewAt), linkUrl: f.linkUrl, essential: f.essential });

/**
 * Publishing as a verified organisation. The form mirrors the server's rules to guide people, but the DATABASE enforces them all and its message
 * is shown verbatim if it disagrees. Editing a notice never notifies anyone; notifying is a separate, explicit, once-only button.
 */
export function PublisherConsole({ publishers, areas, live }: { publishers: MyPublisher[]; areas: Area[]; live: NoticeCardModel[] }) {
  const router = useRouter();
  const [pubId, setPubId] = useState(publishers[0]?.publisher_id ?? "");
  const pub = publishers.find((p) => p.publisher_id === pubId) ?? publishers[0];
  const [f, setF] = useState<Form>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notified, setNotified] = useState<Record<string, boolean>>({});
  const save = useAction();
  const manage = useAction();
  const notify = useAction();
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));
  const mine = live.filter((n) => n.attribution.kind === "official" && n.attribution.label === pub.name);

  const toggleArea = (id: string) => setF((p) => {
    if (id === SHETLAND_WIDE) return { ...p, areaIds: p.areaIds.includes(id) ? [] : [id] };
    const rest = p.areaIds.filter((x) => x !== SHETLAND_WIDE);
    return { ...p, areaIds: rest.includes(id) ? rest.filter((x) => x !== id) : [...rest, id] };
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const input = asInput(f);
    const errs = validateOfficialNotice(input, { canEssential: pub.can_essential });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (editing) {
      const a = officialPublishArgs(pub.publisher_id, input);
      const r = await save.run(() => noticeWrite("official_update_notice", {
        p_notice: editing, p_title: a.p_title, p_body: a.p_body, p_category: a.p_category, p_area_ids: a.p_area_ids, p_expires_at: a.p_expires_at,
        p_link_url: a.p_link_url, p_action_text: a.p_action_text, p_is_essential: a.p_is_essential, p_review_at: a.p_review_at,
      }), "Corrected. Nobody is notified when a notice is edited.");
      if (r.ok) { setEditing(null); setF(EMPTY); router.refresh(); }
    } else {
      const r = await save.run(() => noticeWrite("official_publish_notice", officialPublishArgs(pub.publisher_id, input)), f.essential ? "Published. The alert is live. Use “Notify opted-in members” below if people should be told." : "Published.");
      if (r.ok) { setF(EMPTY); router.refresh(); }
    }
  }

  function edit(n: NoticeCardModel) {
    setEditing(n.id); save.reset();
    setErrors({});
    setF({ title: n.title, body: n.body, actionText: n.actionText ?? "", category: n.categoryId ?? "", areaIds: n.areaIds, startsAt: "", expiresAt: toLocalInput(n.expiresAt), reviewAt: toLocalInput(n.reviewAt), linkUrl: n.linkUrl ?? "", essential: n.isEssential });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function setStatus(n: NoticeCardModel, status: "resolved" | "withdrawn") {
    if (!window.confirm(status === "resolved" ? "Mark this as resolved? It will stop showing." : "Withdraw this notice? It will stop showing.")) return;
    const r = await manage.run(() => noticeWrite("official_set_notice_status", { p_notice: n.id, p_status: status }), status === "resolved" ? "Marked as resolved." : "Withdrawn.");
    if (r.ok) router.refresh();
  }

  async function sendNotify(n: NoticeCardModel) {
    if (!window.confirm("Send a notification about this notice to members who have opted in? This can only be done once for a notice.")) return;
    const r = await notify.run(() => notifyNoticeAudience(n.id, n.isEssential ? "essential" : "official"), "Notification request sent.");
    if (r.ok) setNotified((m) => ({ ...m, [n.id]: true }));
  }

  return (
    <div className="space-y-10">
      {publishers.length > 1 && (
        <Field label="Publishing as" htmlFor="pub"><select id="pub" className={inputCls} value={pubId} onChange={(e) => setPubId(e.target.value)}>{publishers.map((p) => <option key={p.publisher_id} value={p.publisher_id}>{p.name}</option>)}</select></Field>
      )}
      <p className="text-sm text-ink-soft">Publishing as <strong>{pub.name}</strong> ({pub.role === "publisher" ? "authorised publisher" : "delegate"}). {pub.can_essential ? "This organisation can issue Essential Alerts." : "This organisation cannot issue Essential Alerts."}</p>

      <form onSubmit={submit} noValidate className="space-y-5 rounded-card border border-line bg-paper p-5 shadow-soft sm:p-6">
        <h2 className="font-display text-2xl font-bold text-ink">{editing ? "Correct a notice" : "New notice"}</h2>
        {editing && <p className="rounded-lg bg-sand/70 p-3 text-sm text-ink-soft">You are correcting a live notice. Editing does not notify anyone, and the start time cannot be changed. <button type="button" className="font-semibold underline" onClick={() => { setEditing(null); setF(EMPTY); setErrors({}); }}>Cancel</button></p>}
        <Field label="Title" hint="5 to 120 characters." error={errors.title} htmlFor="t"><input id="t" className={inputCls} value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={140} /></Field>
        <Field label="Explanation" hint="What is happening. 20 to 4,000 characters." error={errors.body} htmlFor="b"><textarea id="b" rows={5} className={inputCls} value={f.body} onChange={(e) => set("body", e.target.value)} /></Field>
        <Field label="What people need to do" optional={!f.essential} hint={f.essential ? "Required for an Essential Alert (10 to 500 characters)." : "Up to 500 characters."} error={errors.actionText} htmlFor="a"><textarea id="a" rows={2} className={inputCls} value={f.actionText} onChange={(e) => set("actionText", e.target.value)} /></Field>
        <Field label="Category" error={errors.category} htmlFor="c"><select id="c" className={inputCls} value={f.category} onChange={(e) => set("category", e.target.value)}><option value="">Choose a category</option>{NOTICE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></Field>

        <fieldset>
          <legend className="text-sm font-semibold text-ink">Affected areas</legend>
          <p className="mt-0.5 text-sm text-ink-muted">Choose at least one, or Shetland-wide on its own.</p>
          <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-line">
            <label className="flex min-h-[44px] cursor-pointer items-center gap-3 border-b border-line bg-sand/50 px-3"><input type="checkbox" checked={f.areaIds.includes(SHETLAND_WIDE)} onChange={() => toggleArea(SHETLAND_WIDE)} className="h-5 w-5 accent-[#032f4c]" /><span className="text-sm font-semibold text-ink">Shetland-wide</span></label>
            {areas.map((a) => <label key={a.id} className="flex min-h-[44px] cursor-pointer items-center gap-3 border-b border-line px-3 last:border-0"><input type="checkbox" checked={f.areaIds.includes(a.id)} onChange={() => toggleArea(a.id)} className="h-5 w-5 accent-[#032f4c]" /><span className="text-sm text-ink">{a.name}</span></label>)}
          </div>
          {errors.areaIds && <p role="alert" className="mt-1 text-sm font-medium text-rose-700">{errors.areaIds}</p>}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Starts" optional hint="Leave blank to start now." error={errors.startsAt} htmlFor="s"><input id="s" type="datetime-local" className={inputCls} value={f.startsAt} disabled={!!editing} onChange={(e) => set("startsAt", e.target.value)} /></Field>
          <Field label="Expires" error={errors.expiresAt} hint={f.essential ? "At most 7 days after the start." : "At most 180 days after the start."} htmlFor="x"><input id="x" type="datetime-local" className={inputCls} value={f.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} /></Field>
          {f.essential && <Field label="Review by" error={errors.reviewAt} hint="Between the start and the expiry." htmlFor="r"><input id="r" type="datetime-local" className={inputCls} value={f.reviewAt} onChange={(e) => set("reviewAt", e.target.value)} /></Field>}
        </div>
        <Field label="Link for more information" optional hint="A plain https address." error={errors.linkUrl} htmlFor="l"><input id="l" type="url" inputMode="url" className={inputCls} value={f.linkUrl} onChange={(e) => set("linkUrl", e.target.value)} /></Field>

        {pub.can_essential && (
          <div className="rounded-xl border border-line bg-sand/50 p-4">
            <Check checked={f.essential} onChange={(v) => set("essential", v)}>This is an Essential Alert</Check>
            <p className="ml-8 text-sm text-ink-muted">Essential Alerts take the one reserved place at the top of the homepage. Use them only when people need to act or avoid something now. They need a clear action, a review time and run for up to 7 days. Publishing does not notify anyone.</p>
            {errors.essential && <p role="alert" className="ml-8 text-sm font-medium text-rose-700">{errors.essential}</p>}
          </div>
        )}

        <Status state={save.state} />
        <button type="submit" disabled={save.state.busy} className={btnPrimary}>{save.state.busy ? "Saving…" : editing ? "Save correction" : f.essential ? "Publish alert" : "Publish notice"}</button>
      </form>

      <section aria-labelledby="live-h">
        <h2 id="live-h" className="font-display text-2xl font-bold text-ink">Live notices from {pub.name}</h2>
        <div className="mt-3 space-y-3"><Status state={manage.state} /><Status state={notify.state} /></div>
        {mine.length === 0 ? <p className="mt-3 text-sm text-ink-muted">No live notices from this organisation.</p> : (
          <ul className="mt-3 space-y-3">
            {mine.map((n) => (
              <li key={n.id} className="rounded-xl border border-line bg-paper p-4 shadow-soft">
                <p className="text-xs font-black uppercase tracking-widest text-ink-muted">{n.isEssential ? "Essential alert" : "Official notice"} {"·"} {n.areaSummary}</p>
                <p className="mt-1 break-words font-display text-lg font-bold text-ink">{n.title}</p>
                <p className="mt-1 text-sm text-ink-muted">{n.expiresAt ? `Until ${formatNoticeDateTime(n.expiresAt)}` : ""}{n.reviewAt ? ` · review by ${formatNoticeDateTime(n.reviewAt)}` : ""}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className={btnQuiet} onClick={() => edit(n)}>Correct</button>
                  <button type="button" className={btnQuiet} disabled={manage.state.busy} onClick={() => setStatus(n, "resolved")}>Resolve</button>
                  <button type="button" className={btnDanger} disabled={manage.state.busy} onClick={() => setStatus(n, "withdrawn")}>Withdraw</button>
                  {(n.isEssential || pub.can_publish) && (
                    <button type="button" className={btnPrimary} disabled={notify.state.busy || notified[n.id]} onClick={() => sendNotify(n)}>{notified[n.id] ? "Notification requested" : "Notify opted-in members"}</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-sm text-ink-muted">Notifying is separate from publishing, goes only to members who opted in, and can be done once per notice. Editing a notice never notifies anyone.</p>
      </section>
    </div>
  );
}
