import Link from "next/link";
import { getAccount } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { callRpc } from "@/lib/notices-rpc";
import { MY_NOTICE_STATE, myNoticeAreaLabel, type MyNoticeRow } from "@/lib/notices-alerts";
import { MemberNoticeWithdraw } from "@/components/notices/MemberNotice";
import { Notice, NoticesHeader } from "@/components/notices/NoticesShell";
import { btnPrimary, btnQuiet } from "@/components/notices/Fields";

export const dynamic = "force-dynamic";
export const metadata = { title: "My notices", robots: { index: false } };

const TONE = { amber: "bg-amber-100 text-amber-900", green: "bg-emerald-100 text-emerald-900", gray: "bg-sand text-ink-soft", red: "bg-rose-100 text-rose-900" } as const;
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null);

/** The member's own notices in every state, with what they can do next. Nobody else's are ever listed (the database returns only the caller's). */
export default async function MyNoticesPage() {
  const account = await getAccount();
  const r = account ? await callRpc<MyNoticeRow[]>(await createClient(), "my_person_notices") : null;
  const rows = r && r.ok && Array.isArray(r.data) ? r.data : [];
  return (
    <>
      <NoticesHeader eyebrow="Community" title="My notices" intro="Everything you have posted, and where it has got to." />
      <div className="mx-auto max-w-3xl px-5 py-8 sm:py-10">
        {!account && <Notice>Please <Link className="font-semibold underline" href="/sign-in?next=/notices/mine">sign in</Link> to see your notices.</Notice>}
        {r && !r.ok && <Notice tone="error">Your notices could not be loaded just now ({r.error}). Please try again in a moment.</Notice>}
        {account && r && r.ok && (
          <>
            <p className="mb-5"><Link href="/notices/post" className={btnPrimary}>Post a notice</Link></p>
            {rows.length === 0 ? <Notice>You have not posted any notices yet.</Notice> : (
              <ul className="space-y-4">
                {rows.map((n) => {
                  const st = MY_NOTICE_STATE[n.state];
                  const where = myNoticeAreaLabel(n);
                  return (
                    <li key={n.id} className="rounded-xl border border-line bg-paper p-4 shadow-soft">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-pill px-2.5 py-1 text-xs font-bold ${TONE[st.tone]}`}>{st.label}</span>
                        <span className="text-xs text-ink-muted">{n.category_label ?? "No category"}{where ? ` · ${where}` : ""}</span>
                      </div>
                      <h2 className="mt-2 font-display text-xl font-bold text-ink">{n.title}</h2>
                      <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-ink-soft">{n.body}</p>
                      <p className="mt-2 text-sm text-ink-muted">{st.help}{n.state === "declined" && n.decline_reason ? <> <span className="font-semibold text-ink">Our team said: </span>{n.decline_reason}</> : null}</p>
                      <p className="mt-1 text-xs text-ink-muted">Sent {when(n.created_at)}{n.expires_at && (n.state === "pending" || n.state === "published") ? ` · runs until ${when(n.expires_at)}` : ""}</p>
                      {(n.can_edit || n.can_withdraw) && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {n.can_edit && <Link href={`/notices/post?edit=${n.id}`} className={btnQuiet}>Change</Link>}
                          {n.can_withdraw && <MemberNoticeWithdraw id={n.id} />}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
        <p className="mt-8 text-sm"><Link href="/notices" className="font-semibold text-navy-light underline">Back to notices</Link></p>
      </div>
    </>
  );
}
