import Link from "next/link";
import { getAccount } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { callRpc } from "@/lib/notices-rpc";
import { FuneralTab, type ChangeReq, type FuneralRowAdmin } from "@/components/admin/NoticesAdmin";
import { Notice, NoticesHeader } from "@/components/notices/NoticesShell";
import { PersonNoticeQueueRow, PublishedNoticeRow, type PendingRow, type PublishedRow } from "@/components/notices/MemberNotice";

export const dynamic = "force-dynamic";
export const metadata = { title: "Funeral moderation", robots: { index: false } };

/** Funeral announcements for staff who are not full administrators (moderators). The database functions decide who is staff; anyone else sees its refusal. */
export default async function ModeratePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const account = await getAccount();
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "";
  const sb = account ? await createClient() : null;
  const person = sb ? await callRpc<PendingRow[]>(sb, "staff_pending_person_notices") : null;
  const published = sb ? await callRpc<PublishedRow[]>(sb, "staff_published_person_notices") : null;
  const [q, c] = sb ? await Promise.all([callRpc<FuneralRowAdmin[]>(sb, "admin_funeral_queue", { p_status: status || null }), callRpc<ChangeReq[]>(sb, "admin_funeral_change_requests")]) : [null, null];
  return (
    <>
      <NoticesHeader tone="quiet" eyebrow="Staff" title="Moderation" />
      <div className="mx-auto max-w-4xl px-5 py-8">
        {!account && <Notice>Please <Link className="font-semibold underline" href="/sign-in?next=/notices/moderate">sign in</Link>.</Notice>}
        {person && person.ok && (
          <section aria-labelledby="pn" className="mb-10">
            <h2 id="pn" className="font-display text-2xl font-bold text-ink">Notices awaiting approval ({Array.isArray(person.data) ? person.data.length : 0})</h2>
            {Array.isArray(person.data) && person.data.length > 0
              ? <ul className="mt-4 space-y-4">{person.data.map((r) => <PersonNoticeQueueRow key={r.id} r={r} />)}</ul>
              : <p className="mt-2 text-sm text-ink-muted">Nothing is waiting.</p>}
          </section>
        )}
        {published && published.ok && (
          <section aria-labelledby="pub" className="mb-10">
            <h2 id="pub" className="font-display text-2xl font-bold text-ink">Published member notices ({Array.isArray(published.data) ? published.data.length : 0})</h2>
            <p className="mt-1 text-sm text-ink-muted">Publishing never notifies anyone. You can choose to send one notification to opted-in members who follow the notice&rsquo;s area.</p>
            {Array.isArray(published.data) && published.data.length > 0
              ? <ul className="mt-4 space-y-4">{published.data.map((r) => <PublishedNoticeRow key={r.id} r={r} />)}</ul>
              : <p className="mt-2 text-sm text-ink-muted">No member notices are published.</p>}
          </section>
        )}
        <h2 className="mb-3 font-display text-2xl font-bold text-ink">Funeral announcements</h2>
        {q && !q.ok && <Notice tone="error">{q.error}</Notice>}
        {q && q.ok && <FuneralTab rows={Array.isArray(q.data) ? q.data : []} changes={c && c.ok && Array.isArray(c.data) ? c.data : []} status={status} basePath="/notices/moderate?" />}
      </div>
    </>
  );
}
