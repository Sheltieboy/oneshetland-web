import Link from "next/link";
import { getAccount } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { callRpc } from "@/lib/notices-rpc";
import { formFromSubmission, type MyFuneralSubmission } from "@/lib/notices-alerts";
import { FuneralSubmitForm } from "@/components/notices/FuneralForms";
import { Notice, NoticesHeader } from "@/components/notices/NoticesShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit a funeral announcement" };

/** Edit an announcement that has not been published yet (submitted or needs_info). Pre-filled from my_funeral_submission; saved with update_my_funeral_submission. */
export default async function EditSubmission({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await getAccount();
  const r = account && /^[0-9a-f-]{36}$/i.test(id) ? await callRpc<MyFuneralSubmission | null>(await createClient(), "my_funeral_submission", { p_id: id }) : null;
  const row = r && r.ok && r.data && typeof r.data === "object" ? r.data : null;
  const editable = !!row && (row.status === "submitted" || row.status === "needs_info");
  return (
    <>
      <NoticesHeader tone="quiet" eyebrow="Deaths & funeral notices" title="Edit your announcement" />
      <div className="mx-auto max-w-2xl px-5 py-8 sm:py-10">
        {!account && <Notice>Please <Link className="font-semibold underline" href={`/sign-in?next=/notices/funeral/mine/${id}`}>sign in</Link>.</Notice>}
        {r && !r.ok && <Notice tone="error">This announcement could not be loaded ({r.error}).</Notice>}
        {account && r && r.ok && !row && <Notice>We could not find that announcement among your submissions.</Notice>}
        {row && !editable && <Notice>This announcement can no longer be edited. If it is published you can ask for a correction from <Link className="font-semibold underline" href="/notices/funeral/mine">your submissions</Link>.</Notice>}
        {row && editable && <FuneralSubmitForm areas={[]} edit={{ id, initial: formFromSubmission(row), reviewMessage: typeof row.review_message === "string" ? row.review_message : null }} />}
        <p className="mt-8 text-sm"><Link href="/notices/funeral/mine" className="font-semibold text-navy-light underline">Back to my submissions</Link></p>
      </div>
    </>
  );
}
