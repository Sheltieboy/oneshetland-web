"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { noticeRead, noticeWrite, notifyNoticeAudience } from "@/app/notices/actions";
import {
  EMPTY_MEMBER_NOTICE_FORM, MEMBER_NOTICE_MAX_AREAS, NOTICE_CATEGORIES, buildMemberNoticeArgs, validateMemberNotice,
  type FieldErrors, type MemberNoticeForm,
} from "@/lib/notices-alerts";
import { Check, Field, Status, btnDanger, btnPrimary, btnQuiet, inputCls, useAction } from "@/components/notices/Fields";

/**
 * A signed-in member posts (or edits) a notice. It is moderated: it starts "awaiting approval", nobody else can see it until a member of our team approves it,
 * and editing an approved notice sends it back for approval. The member chooses a place (Shetland-wide, or specific areas); the form never offers "no place".
 */
export type MemberEdit = { id: string; initial: MemberNoticeForm; wasPublished: boolean };
export function MemberNoticeForm({ areas, displayName, edit }: { areas: { id: string; name: string }[]; displayName: string; edit?: MemberEdit }) {
  const [f, setF] = useState<MemberNoticeForm>(edit?.initial ?? EMPTY_MEMBER_NOTICE_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [done, setDone] = useState(false);
  const [find, setFind] = useState("");
  const { state, run } = useAction();
  // changing a field clears its own message (a stale "choose a place" must not linger after the member has chosen one)
  const FIELD_ERROR: Record<string, string> = { title: "title", body: "body", category: "category", scope: "areas", areaIds: "areas", expires: "expires" };
  const set = <K extends keyof MemberNoticeForm>(k: K, v: MemberNoticeForm[K]) => { setF((p) => ({ ...p, [k]: v })); setErrors((e) => { const n = { ...e }; delete n[FIELD_ERROR[k]]; return n; }); };
  const shown = useMemo(() => areas.filter((a) => a.name.toLowerCase().includes(find.trim().toLowerCase())), [areas, find]);
  const toggle = (id: string) => set("areaIds", f.areaIds.includes(id) ? f.areaIds.filter((x) => x !== id) : [...f.areaIds, id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateMemberNotice(f);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const args = buildMemberNoticeArgs(f);
    const r = await run(() => edit ? noticeWrite("edit_my_person_notice", { p_notice: edit.id, ...args }) : noticeWrite("submit_person_notice", args), "");
    if (r.ok) setDone(true);
  }

  if (done) {
    return (
      <div className="rounded-xl border border-line bg-paper p-6 shadow-soft" role="status">
        <h2 className="font-display text-2xl font-bold text-ink">{edit ? "Thank you. Your changes are saved." : "Thank you. Your notice has been sent."}</h2>
        <p className="mt-3 text-ink-soft">It is <strong>awaiting approval</strong>. A member of our team will read it before anyone else can see it{edit?.wasPublished ? ", and the version people could see has been taken down until then" : ""}. You can follow it, change it or withdraw it under My notices.</p>
        <p className="mt-4 flex flex-wrap gap-3"><Link href="/notices/mine" className={btnPrimary}>See my notices</Link><Link href="/notices" className={btnQuiet}>Back to notices</Link></p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      <div className="rounded-xl border border-line bg-sand/60 p-4 text-sm text-ink-soft">
        <p className="font-semibold text-ink">{edit ? "Changing your notice" : "Before you post"}</p>
        <p className="mt-1">Notices from members are read by our team before they appear. {edit?.wasPublished ? "Because this one is already published, saving your changes takes it down until it has been approved again." : "Nothing is shown to anyone until it is approved."} Once approved it is shown as <strong>Posted by {displayName}</strong>.</p>
        <p className="mt-1">For emergencies call 999. Please don’t use a notice to sell things or to name people.</p>
      </div>

      <fieldset className="space-y-4">
        <legend className="font-display text-xl font-bold text-ink">Your notice</legend>
        <Field label="Title" hint="5 to 120 characters." error={errors.title} htmlFor="mn-title"><input id="mn-title" className={inputCls} value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={120} autoComplete="off" /></Field>
        <Field label="What is it about?" hint="10 to 2,000 characters." error={errors.body} htmlFor="mn-body"><textarea id="mn-body" rows={6} className={inputCls} value={f.body} onChange={(e) => set("body", e.target.value)} maxLength={2000} /></Field>
        <Field label="Category" error={errors.category} htmlFor="mn-cat">
          <select id="mn-cat" className={inputCls} value={f.category} onChange={(e) => set("category", e.target.value)}>
            <option value="">Choose a category</option>{NOTICE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </Field>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-display text-xl font-bold text-ink">Where is it relevant?</legend>
        <div role="radiogroup" aria-label="Where is it relevant?" className="space-y-1">
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3"><input type="radio" name="scope" checked={f.scope === "wide"} onChange={() => set("scope", "wide")} className="h-5 w-5 accent-[#032f4c]" /><span><span className="font-semibold text-ink">Shetland-wide</span><span className="block text-sm text-ink-muted">Everyone in the isles.</span></span></label>
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3"><input type="radio" name="scope" checked={f.scope === "areas"} onChange={() => set("scope", "areas")} className="h-5 w-5 accent-[#032f4c]" /><span><span className="font-semibold text-ink">Specific places</span><span className="block text-sm text-ink-muted">Up to {MEMBER_NOTICE_MAX_AREAS}.</span></span></label>
        </div>
        {f.scope === "areas" && (
          <div className="rounded-xl border border-line bg-paper p-3">
            <label htmlFor="mn-find" className="sr-only">Search places</label>
            <input id="mn-find" type="search" className={inputCls} placeholder="Search places" value={find} onChange={(e) => setFind(e.target.value)} autoComplete="off" />
            <p className="mt-2 text-sm text-ink-muted" aria-live="polite">{f.areaIds.length === 0 ? "No places chosen yet." : `${f.areaIds.length} chosen: ${areas.filter((a) => f.areaIds.includes(a.id)).map((a) => a.name).join(", ")}`}</p>
            <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-line" role="group" aria-label="Places">
              {shown.map((a) => <div key={a.id} className="border-b border-line last:border-b-0"><Check checked={f.areaIds.includes(a.id)} onChange={() => toggle(a.id)} disabled={!f.areaIds.includes(a.id) && f.areaIds.length >= MEMBER_NOTICE_MAX_AREAS}><span className="px-1">{a.name}</span></Check></div>)}
              {shown.length === 0 && <p className="p-3 text-sm text-ink-muted">No place matches “{find}”.</p>}
            </div>
          </div>
        )}
        {errors.areas && <p role="alert" className="text-sm font-medium text-rose-700">{errors.areas}</p>}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-display text-xl font-bold text-ink">How long should it run?</legend>
        <Field label="Last day" optional hint="Leave blank and it runs for 30 days. At most 90 days." error={errors.expires} htmlFor="mn-exp"><input id="mn-exp" type="datetime-local" className={inputCls} value={f.expires} onChange={(e) => set("expires", e.target.value)} /></Field>
      </fieldset>

      <div className="space-y-3">
        <Status state={state} />
        <div className="flex flex-wrap gap-3">
          <button type="submit" className={btnPrimary} disabled={state.busy}>{state.busy ? "Sending…" : edit ? "Save and send for approval" : "Send for approval"}</button>
          <Link href={edit ? "/notices/mine" : "/notices"} className={btnQuiet}>Cancel</Link>
        </div>
      </div>
    </form>
  );
}

/** Withdraw (with a confirmation) on a row of My notices. */
export function MemberNoticeWithdraw({ id }: { id: string }) {
  const router = useRouter();
  const { state, run } = useAction();
  async function go() {
    if (!window.confirm("Withdraw this notice? It will stop showing straight away.")) return;
    const r = await run(() => noticeWrite("withdraw_my_person_notice", { p_notice: id }), "Withdrawn.");
    if (r.ok) router.refresh();
  }
  return <><button type="button" className={btnDanger} disabled={state.busy} onClick={go}>Withdraw</button>{state.error && <p role="alert" className="basis-full text-sm font-medium text-rose-700">{state.error}</p>}</>;
}

/** Staff: approve or decline a member's notice. A decline needs a reason, which the member is shown. */
export type PendingRow = { id: string; title: string; body: string; category_label: string | null; created_at: string; expires_at: string | null; area_ids: string[]; area_names: string[]; author_name: string; author_pending: number; edited: boolean };
export function PersonNoticeQueueRow({ r }: { r: PendingRow }) {
  const router = useRouter();
  const { state, run } = useAction();
  const [reason, setReason] = useState("");
  const [declining, setDeclining] = useState(false);
  const wide = r.area_ids.length === 1 && r.area_ids[0] === "shetland_wide";
  const where = r.area_ids.length === 0 ? "No place chosen" : wide ? "Shetland-wide" : r.area_names.join(", ");
  return (
    <li className="rounded-xl border border-line bg-paper p-4 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{r.category_label ?? "No category"} · {where}{r.edited ? " · edited" : ""}</p>
      <h3 className="mt-1 font-display text-lg font-bold text-ink">{r.title}</h3>
      <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{r.body}</p>
      <p className="mt-2 text-xs text-ink-muted">From {r.author_name} ({r.author_pending} awaiting) · sent {new Date(r.created_at).toLocaleString("en-GB")}{r.expires_at ? ` · ends ${new Date(r.expires_at).toLocaleDateString("en-GB")}` : ""}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className={btnPrimary} disabled={state.busy} onClick={async () => { const x = await run(() => noticeWrite("staff_approve_person_notice", { p_notice: r.id }), "Approved and published. No notification was sent: you can notify opted-in members from \u201cPublished member notices\u201d below."); if (x.ok) router.refresh(); }}>Approve</button>
        {!declining && <button type="button" className={btnDanger} onClick={() => setDeclining(true)}>Decline…</button>}
      </div>
      <p className="mt-2 text-xs text-ink-muted">Approving publishes the notice. It never sends a notification: that is a separate choice you can make afterwards.</p>
      {declining && (
        <div className="mt-3 space-y-2">
          <Field label="Why is it not being published?" hint="The member is shown this." htmlFor={`dr-${r.id}`}><textarea id={`dr-${r.id}`} rows={2} className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <div className="flex gap-2">
            <button type="button" className={btnDanger} disabled={state.busy || reason.trim().length < 5} onClick={async () => { const x = await run(() => noticeWrite("staff_decline_person_notice", { p_notice: r.id, p_reason: reason }), "Declined."); if (x.ok) router.refresh(); }}>Decline notice</button>
            <button type="button" className={btnQuiet} onClick={() => setDeclining(false)}>Cancel</button>
          </div>
        </div>
      )}
      <div className="mt-2"><Status state={state} /></div>
    </li>
  );
}


/** Staff: a PUBLISHED member notice, and the separate, deliberate "Notify opted-in members" action with a preview and a confirmation. */
export type PublishedRow = {
  id: string; title: string; category_label: string | null; area_ids: string[]; area_names: string[]; area_state: "specific" | "shetland_wide" | "none";
  published_at: string | null; expires_at: string | null; can_notify: boolean; reason: string | null; dispatch_status: string | null;
  delivery: { sent: number; quiet_hours: number; skipped: number; failed: number };
};
type Preview = { notice_id: string; title: string; publisher: string; area_state: string; areas: string[]; push_title: string; push_body: string; can_notify: boolean; reason: string | null; estimate: number; only_opted_in: boolean; daily_limit: number };

export function PublishedNoticeRow({ r }: { r: PublishedRow }) {
  const router = useRouter();
  const load = useAction();
  const send = useAction();
  const [preview, setPreview] = useState<Preview | null>(null);
  const where = r.area_state === "none" ? "No place chosen" : r.area_state === "shetland_wide" ? "Shetland-wide" : r.area_names.join(", ");
  const d = r.delivery;
  const notified = r.dispatch_status === "completed";
  return (
    <li className="rounded-xl border border-line bg-paper p-4 shadow-soft" data-testid={`published-${r.id}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{r.category_label ?? "No category"} · {where}{r.expires_at ? ` · ends ${new Date(r.expires_at).toLocaleDateString("en-GB")}` : ""}</p>
      <h3 className="mt-1 font-display text-lg font-bold text-ink">{r.title}</h3>
      <p className="mt-1 text-sm text-ink-soft" data-testid="notified-state">
        {notified ? `Notification run finished: ${d.sent} accepted by the push service, ${d.quiet_hours} not sent because the member was in quiet hours (they are not notified later), ${d.skipped} skipped, ${d.failed} failed.`
          : r.dispatch_status === "claimed" ? "A notification is in progress."
          : r.dispatch_status === "failed" ? "A notification was interrupted and can be resumed."
          : "No notification has been sent for this notice."}
      </p>
      {!preview && (
        <div className="mt-3">
          <button type="button" className={btnQuiet} disabled={!r.can_notify || load.state.busy} onClick={async () => { const x = await load.run(() => noticeRead("staff_member_notice_preview", { p_notice: r.id }), "Preview ready."); if (x.ok) setPreview(x.data as Preview); }}>Notify opted-in members…</button>
          {!r.can_notify && r.reason && <p className="mt-1 text-xs text-ink-muted">{r.reason}.</p>}
        </div>
      )}
      {preview && (
        <section aria-label="Notification preview" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <h4 className="font-bold">Check before sending</h4>
          <dl className="mt-2 space-y-1">
            <div><dt className="inline font-semibold">Notice: </dt><dd className="inline">{preview.title}</dd></div>
            <div><dt className="inline font-semibold">Posted by: </dt><dd className="inline">{preview.publisher}</dd></div>
            <div><dt className="inline font-semibold">Area: </dt><dd className="inline">{preview.area_state === "shetland_wide" ? "Shetland-wide" : preview.areas.join(", ")}</dd></div>
            <div><dt className="font-semibold">The notification will say:</dt><dd className="mt-1 rounded border border-amber-300 bg-white p-2"><span className="block font-semibold">{preview.push_title}</span><span className="block">{preview.push_body}</span></dd></div>
            <div><dt className="inline font-semibold">Estimated recipients: </dt><dd className="inline" data-testid="estimate">{preview.estimate} opted-in member{preview.estimate === 1 ? "" : "s"}</dd></div>
          </dl>
          <p className="mt-2">Only members who opted in to Community Notices, follow a matching area, have notifications on and are not in quiet hours will receive it. Each member receives at most {preview.daily_limit} member notices in 24 hours. Members&rsquo; names and settings are not shown to you, and this cannot be sent again.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={btnPrimary} disabled={send.state.busy || !preview.can_notify || preview.estimate < 1}
              onClick={async () => { const x = await send.run(() => notifyNoticeAudience(r.id, "member"), "The notification run has finished. Its result is shown at the top of this notice."); if (x.ok) { setPreview(null); router.refresh(); } }}>
              {send.state.busy ? "Sending…" : `Send to about ${preview.estimate} member${preview.estimate === 1 ? "" : "s"}`}
            </button>
            <button type="button" className={btnQuiet} disabled={send.state.busy} onClick={() => { setPreview(null); send.reset(); }}>Cancel</button>
          </div>
          {preview.estimate < 1 && <p className="mt-2 text-xs">Nobody is currently eligible, so there is nothing to send.</p>}
        </section>
      )}
      <div className="mt-2"><Status state={load.state} /><Status state={send.state} /></div>
    </li>
  );
}
