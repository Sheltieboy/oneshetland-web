import Link from "next/link";
import { getAccount } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { callRpc } from "@/lib/notices-rpc";
import { FuneralTab, type ChangeReq, type FuneralRowAdmin } from "@/components/admin/NoticesAdmin";
import { Notice, NoticesHeader } from "@/components/notices/NoticesShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Funeral moderation", robots: { index: false } };

/** Funeral announcements for staff who are not full administrators (moderators). The database functions decide who is staff; anyone else sees its refusal. */
export default async function ModeratePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const account = await getAccount();
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "";
  const sb = account ? await createClient() : null;
  const [q, c] = sb ? await Promise.all([callRpc<FuneralRowAdmin[]>(sb, "admin_funeral_queue", { p_status: status || null }), callRpc<ChangeReq[]>(sb, "admin_funeral_change_requests")]) : [null, null];
  return (
    <>
      <NoticesHeader tone="quiet" eyebrow="Staff" title="Funeral moderation" />
      <div className="mx-auto max-w-4xl px-5 py-8">
        {!account && <Notice>Please <Link className="font-semibold underline" href="/sign-in?next=/notices/moderate">sign in</Link>.</Notice>}
        {q && !q.ok && <Notice tone="error">{q.error}</Notice>}
        {q && q.ok && <FuneralTab rows={Array.isArray(q.data) ? q.data : []} changes={c && c.ok && Array.isArray(c.data) ? c.data : []} status={status} basePath="/notices/moderate?" />}
      </div>
    </>
  );
}
