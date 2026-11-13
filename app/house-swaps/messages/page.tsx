import Link from "next/link";
import { currentUserId, getMyListing, getThreads, requireHouseSwaps } from "@/lib/house-swaps-data";
import { cleanFlash, formatWhen, otherSide, signInHref } from "@/lib/house-swaps";
import { Panel, SwapsHeader, SwapsNav, btnPrimary, btnSecondary } from "@/components/house-swaps/Shell";
import { Notice } from "@/components/notices/NoticesShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "House Swaps · Messages" };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireHouseSwaps();
  const sp = await searchParams;
  const userId = await currentUserId();
  if (!userId) {
    return (
      <>
        <SwapsHeader title="Messages" />
        <SwapsNav current="messages" />
        <div className="mx-auto max-w-3xl px-5 py-10"><Panel><h2 className="font-display text-2xl font-bold text-ink">Sign in to see your messages</h2><p className="mt-2 text-ink-soft">Private enquiries about adverts appear here.</p><Link href={signInHref("/house-swaps/messages")} className={`${btnPrimary} mt-4`}>Sign in or join</Link></Panel></div>
      </>
    );
  }
  const [threads, mine] = await Promise.all([getThreads(), getMyListing()]);
  const rows = threads.ok ? threads.data : [];
  const unread = mine.ok && mine.data ? mine.data.unread_enquiries : rows.reduce((n, t) => n + t.unread, 0);
  const blocked = cleanFlash(sp.blocked);

  return (
    <>
      <SwapsHeader title="Messages" intro={<p>Private enquiries about adverts. Your name and contact details are never shown here.</p>} />
      <SwapsNav current="messages" unread={unread} />
      <div className="mx-auto max-w-3xl px-5 py-8 sm:py-10">
        {blocked && <div className="mb-4"><Notice tone="ok">That member has been blocked and the conversation closed.</Notice></div>}
        {!threads.ok && <Notice tone="error">Your messages could not be loaded just now ({threads.error}).</Notice>}
        {threads.ok && rows.length === 0 && (
          <div className="rounded-card border border-dashed border-line-strong bg-paper p-8 text-center">
            <h2 className="font-display text-xl font-bold text-ink">No messages yet</h2>
            <p className="mx-auto mt-2 max-w-md text-ink-soft">When you express interest in an advert, or someone is interested in yours, the conversation appears here.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3"><Link href="/house-swaps" className={btnPrimary}>Browse adverts</Link><Link href="/house-swaps/my" className={btnSecondary}>My advert</Link></div>
          </div>
        )}
        <ul className="space-y-3">
          {rows.map((t) => {
            const o = otherSide(t);
            return (
              <li key={t.thread_id}>
                <Link href={`/house-swaps/messages/${t.thread_id}`} className="block min-h-[56px] rounded-card border border-line bg-paper p-4 shadow-soft transition hover:shadow-lift focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 break-words font-display text-lg font-bold text-ink">{o.title}</p>
                    {t.unread > 0 && <span className="shrink-0 rounded-pill bg-rose-600 px-2.5 py-0.5 text-xs font-bold text-white">{t.unread} new</span>}
                  </div>
                  <p className="mt-0.5 text-sm text-ink-muted">{o.sub}</p>
                  {t.last_message && <p className="mt-2 line-clamp-2 break-words text-sm text-ink-soft">{t.last_message}</p>}
                  <p className="mt-2 text-xs font-semibold text-ink-muted">{t.role === "sent" ? "You asked about this advert" : "They asked about yours"} · {formatWhen(t.last_message_at)}{t.status === "closed" ? " · Closed" : ""}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
