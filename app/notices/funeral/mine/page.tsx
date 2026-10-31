import Link from "next/link";
import { getAccount } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { callRpc } from "@/lib/notices-rpc";
import { MySubmissions, type Submission } from "@/components/notices/FuneralForms";
import { Notice, NoticesHeader } from "@/components/notices/NoticesShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "My funeral announcements" };

export default async function MyFuneralSubmissions() {
  const account = await getAccount();
  const r = account ? await callRpc<Submission[]>(await createClient(), "my_funeral_submissions") : null;
  return (
    <>
      <NoticesHeader tone="quiet" eyebrow="Deaths & funeral notices" title="My submissions" intro="Where each announcement has got to." />
      <div className="mx-auto max-w-2xl px-5 py-8 sm:py-10">
        {!account && <div className="rounded-xl border border-line bg-paper p-6 shadow-soft"><h2 className="font-display text-2xl font-bold text-ink">Sign in to see your submissions</h2><p className="mt-4"><Link href="/sign-in?next=/notices/funeral/mine" className="inline-flex min-h-[44px] items-center rounded-pill bg-navy px-5 text-sm font-bold text-paper">Sign in</Link></p></div>}
        {r && !r.ok && <Notice tone="error">Your submissions could not be loaded ({r.error}).</Notice>}
        {r && r.ok && <MySubmissions rows={Array.isArray(r.data) ? r.data : []} />}
        <p className="mt-8 flex gap-6 text-sm"><Link href="/notices/funeral/submit" className="font-semibold text-navy-light underline">Submit another</Link><Link href="/notices/funeral" className="font-semibold text-navy-light underline">Funeral notices</Link></p>
      </div>
    </>
  );
}
