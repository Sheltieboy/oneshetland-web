import Link from "next/link";
import { getAccount, accountName } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { callRpc } from "@/lib/notices-rpc";
import { getAreaOptions } from "@/lib/notices-data";
import { memberFormFromRow, type MyNoticeRow } from "@/lib/notices-alerts";
import { MemberNoticeForm } from "@/components/notices/MemberNotice";
import { Notice, NoticesHeader } from "@/components/notices/NoticesShell";
import { btnPrimary } from "@/components/notices/Fields";

export const dynamic = "force-dynamic";
export const metadata = { title: "Post a notice", robots: { index: false } };

/** A signed-in member posts a notice (or edits one of their own with ?edit=<id>). Signed-out visitors are sent to sign in and brought back here. */
export default async function PostNoticePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const editId = typeof sp.edit === "string" && /^[0-9a-f-]{36}$/i.test(sp.edit) ? sp.edit : null;
  const here = editId ? `/notices/post?edit=${editId}` : "/notices/post";
  const account = await getAccount();
  let edit: { id: string; initial: ReturnType<typeof memberFormFromRow>; wasPublished: boolean } | null = null;
  let problem: string | null = null;
  if (account && editId) {
    const r = await callRpc<MyNoticeRow[]>(await createClient(), "my_person_notices");
    const row = r.ok && Array.isArray(r.data) ? r.data.find((x) => x.id === editId) : undefined;
    if (!row) problem = "We could not find that notice among yours.";
    else if (!row.can_edit) problem = "That notice can no longer be changed. You can post a new one instead.";
    else edit = { id: row.id, initial: memberFormFromRow(row), wasPublished: row.state === "published" };
  }
  const areas = account ? (await getAreaOptions()).map((a) => ({ id: a.id, name: a.name })) : [];
  return (
    <>
      <NoticesHeader eyebrow="Community" title={editId ? "Change your notice" : "Post a notice"} intro="Tell your neighbours about something that matters locally. Our team reads every notice before it appears." />
      <div className="mx-auto max-w-2xl px-5 py-8 sm:py-10">
        {!account ? (
          <div className="rounded-xl border border-line bg-paper p-6 shadow-soft">
            <h2 className="font-display text-2xl font-bold text-ink">Sign in to post a notice</h2>
            <p className="mt-2 text-ink-soft">We ask you to sign in so that your notice is yours: you can follow it, change it or withdraw it later.</p>
            <p className="mt-4"><Link href={`/sign-in?next=${encodeURIComponent(here)}`} className={btnPrimary}>Sign in</Link></p>
          </div>
        ) : problem ? <Notice tone="error">{problem} <Link className="font-semibold underline" href="/notices/mine">Back to my notices</Link></Notice>
        : <MemberNoticeForm areas={areas} displayName={accountName(account)} edit={edit ?? undefined} />}
        <p className="mt-8 flex flex-wrap gap-x-6 text-sm"><Link href="/notices" className="font-semibold text-navy-light underline">Back to notices</Link>{account && <Link href="/notices/mine" className="font-semibold text-navy-light underline">My notices</Link>}</p>
      </div>
    </>
  );
}
