import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUserId, getMyListing, getThreadMessages, getThreads, requireHouseSwaps } from "@/lib/house-swaps-data";
import { NEVER_PAY, SAFE_CHAT_NOTE, cleanFlash, formatWhen, isUuid, otherSide, signInHref, LIMITS } from "@/lib/house-swaps";
import { sendReply } from "@/app/house-swaps/actions";
import { ActionForm } from "@/components/house-swaps/ActionForm";
import { ThreadControls } from "@/components/house-swaps/ThreadControls";
import { Panel, SwapsHeader, SwapsNav, btnPrimary, fieldCls } from "@/components/house-swaps/Shell";
import { Notice } from "@/components/notices/NoticesShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "House Swaps · Conversation" };

export default async function ThreadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireHouseSwaps();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const sent = cleanFlash((await searchParams).sent);
  if (!(await currentUserId())) {
    return (
      <>
        <SwapsHeader title="Conversation" />
        <SwapsNav current="messages" />
        <div className="mx-auto max-w-3xl px-5 py-10"><Panel><h2 className="font-display text-2xl font-bold text-ink">Sign in to read this conversation</h2><Link href={signInHref(`/house-swaps/messages/${id}`)} className={`${btnPrimary} mt-4`}>Sign in</Link></Panel></div>
      </>
    );
  }
  // Reading marks the other side's messages as read, so fetch the thread list (for its summary) first, then the messages.
  const threads = await getThreads();
  const t = threads.ok ? threads.data.find((x) => x.thread_id === id) : undefined;
  const msgs = await getThreadMessages(id);
  if (!msgs.ok && !t) notFound();
  const mine = await getMyListing();
  const unread = mine.ok && mine.data ? mine.data.unread_enquiries : 0;
  const o = t ? otherSide(t) : null;
  const open = !t || t.status === "open";

  return (
    <>
      <SwapsHeader title={o?.title ?? "Conversation"} eyebrow="Private conversation" intro={o ? <p>{o.sub}</p> : undefined} />
      <SwapsNav current="messages" unread={unread} />
      <div className="mx-auto max-w-3xl px-5 py-8 sm:py-10">
        <Link href="/house-swaps/messages" className="inline-flex min-h-[44px] items-center text-sm font-semibold text-navy-light underline">{"←"} All messages</Link>
        {sent && <div className="mt-2"><Notice tone="ok">Your message has been sent. You&apos;ll see their reply here.</Notice></div>}
        <p className="mt-3 rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">{SAFE_CHAT_NOTE} <span className="mt-2 block font-semibold">{NEVER_PAY}</span></p>

        {!msgs.ok && <div className="mt-4"><Notice tone="error">This conversation could not be loaded ({msgs.error}).</Notice></div>}
        {msgs.ok && (
          <ol className="mt-5 space-y-3" aria-label="Messages">
            {msgs.data.map((m) => (
              <li key={m.id} className={"flex " + (m.mine ? "justify-end" : "justify-start")}>
                <div className={"max-w-[85%] rounded-2xl px-4 py-3 " + (m.mine ? "rounded-br-md bg-navy text-paper" : "rounded-bl-md border border-line bg-paper text-ink shadow-soft")}>
                  <p className="sr-only">{m.mine ? "You wrote:" : "They wrote:"}</p>
                  <p className="whitespace-pre-line break-words text-[15px] leading-relaxed">{m.body}</p>
                  <p className={"mt-1 text-[11px] font-semibold " + (m.mine ? "text-paper/70" : "text-ink-muted")}>{formatWhen(m.created_at)}</p>
                </div>
              </li>
            ))}
          </ol>
        )}

        {open ? (
          <ActionForm action={sendReply} className="mt-6 space-y-3">
            <input type="hidden" name="thread" value={id} />
            <label htmlFor="reply" className="block text-sm font-semibold text-ink">Reply</label>
            <textarea id="reply" name="body" required rows={3} maxLength={LIMITS.message} className={fieldCls} />
            <button type="submit" className={btnPrimary}>Send</button>
          </ActionForm>
        ) : <div className="mt-6"><Notice>This conversation is closed, so no more messages can be sent.</Notice></div>}

        <div className="mt-8 border-t border-line pt-5">
          <h2 className="font-display text-lg font-bold text-ink">Something wrong?</h2>
          <div className="mt-3"><ThreadControls thread={id} open={open} /></div>
        </div>
      </div>
    </>
  );
}
