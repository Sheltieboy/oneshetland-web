import Link from "next/link";
import { getAccount } from "@/lib/auth";
import { adminAccessFor } from "@/lib/admin-access";
import { getInvites, getModerationQueue, getReportedThread, getReports, requireHouseSwaps } from "@/lib/house-swaps-data";
import { MODERATION_TABS, cleanFlash, formatWhen, reasonLabel, isUuid, parseModerationTab, signInHref } from "@/lib/house-swaps";
import { Panel, SwapsHeader, btnPrimary, btnSecondary, fieldCls } from "@/components/house-swaps/Shell";
import { InvitesPanel } from "@/components/house-swaps/InvitesPanel";
import { ModerationCard } from "@/components/house-swaps/ModerationCard";
import { Notice } from "@/components/notices/NoticesShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "House Swaps · Moderation" };

/** Staff only. The page checks the role to be helpful; the database functions are what actually refuse anyone who is not staff. */
export default async function ModeratePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireHouseSwaps();
  const sp = await searchParams;
  const account = await getAccount();
  const access = adminAccessFor(account);
  if (access !== "allow") {
    return (
      <>
        <SwapsHeader title="Moderation" eyebrow="Staff" />
        <div className="mx-auto max-w-3xl px-5 py-10">
          <Panel>
            <h2 className="font-display text-2xl font-bold text-ink">{access === "sign_in" ? "Please sign in" : "Staff only"}</h2>
            <p className="mt-2 text-ink-soft">{access === "sign_in" ? "Sign in with a staff account to moderate adverts." : "This page is for the OneShetland team."}</p>
            <Link href={access === "sign_in" ? signInHref("/house-swaps/moderate") : "/house-swaps"} className={`${btnPrimary} mt-4`}>{access === "sign_in" ? "Sign in" : "Back to House Swaps"}</Link>
          </Panel>
        </div>
      </>
    );
  }
  const tab = parseModerationTab(sp.tab);
  const threadId = typeof sp.thread === "string" && isUuid(sp.thread) ? sp.thread : null;
  const [queue, thread, reports, invites] = await Promise.all([getModerationQueue(tab), threadId ? getReportedThread(threadId) : null, tab === "reported" ? getReports() : null, getInvites()]);
  const done = cleanFlash(sp.done);

  return (
    <>
      <SwapsHeader title="Moderation" eyebrow="Staff" intro={<p>Every new advert, and any change to an advert&apos;s wording or photos, waits here. Reject and hide need a short reason, which the member sees.</p>} />
      <div className="mx-auto max-w-4xl px-5 py-8">
        <InvitesPanel invites={invites.ok ? invites.data : []} error={invites.ok ? undefined : invites.error} />
        <nav aria-label="Advert state" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {MODERATION_TABS.map((t) => <Link key={t.id} href={`/house-swaps/moderate?tab=${t.id}`} aria-current={tab === t.id ? "page" : undefined} className={"inline-flex min-h-[44px] shrink-0 items-center rounded-pill px-4 text-sm font-semibold " + (tab === t.id ? "bg-navy text-paper shadow-soft" : "border border-line-strong text-ink-soft hover:bg-sand")}>{t.label}</Link>)}
        </nav>

        {done && <div className="mt-4"><Notice tone="ok">{done}</Notice></div>}
        <div className="mt-6">
          {!queue.ok && <Notice tone="error">{queue.error}</Notice>}
          {queue.ok && queue.data.length === 0 && <Notice>Nothing in &ldquo;{MODERATION_TABS.find((t) => t.id === tab)?.label}&rdquo; right now.</Notice>}
          {queue.ok && queue.data.length > 0 && <ul className="space-y-5">{queue.data.map((r) => <li key={r.id}><ModerationCard r={r} tab={tab} /></li>)}</ul>}
        </div>

        {tab === "reported" && reports && (
          <section aria-labelledby="or" className="mt-10">
            <h2 id="or" className="font-display text-2xl font-bold text-ink">Open reports</h2>
            {!reports.ok && <div className="mt-3"><Notice tone="error">{reports.error}</Notice></div>}
            {reports.ok && reports.data.length === 0 && <p className="mt-2 text-sm text-ink-muted">No open reports.</p>}
            {reports.ok && reports.data.length > 0 && (
              <ul className="mt-4 space-y-3">
                {reports.data.map((r) => (
                  <li key={r.report_id} className="rounded-card border border-line bg-paper p-4 shadow-soft">
                    <p className="text-xs font-bold text-ink-muted">{r.kind === "thread" ? "Reported conversation" : "Reported advert"} · {formatWhen(r.created_at)}</p>
                    <p className="mt-1 font-semibold text-ink">{reasonLabel(r.reason)}</p>
                    {r.details && <p className="mt-1 whitespace-pre-line break-words text-sm text-ink-soft">Reporter&apos;s note: {r.details}</p>}
                    {r.advert_summary && <p className="mt-1 text-sm text-ink-muted">About: {r.advert_summary}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {r.listing_id && <Link href={`/house-swaps/${r.listing_id}`} className={btnSecondary}>View the advert</Link>}
                      {r.kind === "thread" && <Link href={`/house-swaps/moderate?tab=reported&thread=${r.content_id}#reported-thread`} className={btnPrimary}>Open reported conversation</Link>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section id="reported-thread" aria-labelledby="rt" className="mt-12 border-t border-line pt-6">
          <h2 id="rt" className="font-display text-2xl font-bold text-ink">Reported conversation</h2>
          <p className="mt-1 text-sm text-ink-muted">A conversation can only be opened once someone has reported it, and every opening is logged. Participants appear as &ldquo;Member A&rdquo; and &ldquo;Member B&rdquo;.</p>
          <form method="get" action="/house-swaps/moderate" className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="tab" value={tab} />
            <div className="min-w-[16rem] flex-1">
              <label htmlFor="thr" className="block text-sm font-semibold text-ink">Reported conversation reference</label>
              <input id="thr" name="thread" defaultValue={threadId ?? ""} inputMode="text" autoComplete="off" spellCheck={false} className={fieldCls} />
            </div>
            <button type="submit" className={btnSecondary}>Open</button>
          </form>
          {thread && !thread.ok && <div className="mt-4"><Notice tone="error">{thread.error}</Notice></div>}
          {thread && thread.ok && (
            <ol className="mt-4 space-y-2" aria-label="Reported conversation">
              {thread.data.map((m, i) => <li key={i} className="rounded-xl border border-line bg-paper p-3"><p className="text-xs font-bold text-ink-muted">{m.sender} · {formatWhen(m.created_at)}</p><p className="mt-1 whitespace-pre-line break-words text-sm text-ink">{m.body}</p></li>)}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}
