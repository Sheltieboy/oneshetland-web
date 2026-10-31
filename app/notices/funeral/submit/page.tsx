import Link from "next/link";
import { getAccount } from "@/lib/auth";
import { getAreaOptions } from "@/lib/notices-data";
import { FuneralSubmitForm } from "@/components/notices/FuneralForms";
import { NoticesHeader } from "@/components/notices/NoticesShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Submit a funeral announcement" };

export default async function SubmitFuneralPage() {
  const account = await getAccount();
  const areas = account ? (await getAreaOptions()).map((a) => ({ id: a.id, name: a.name })) : [];
  return (
    <>
      <NoticesHeader tone="quiet" eyebrow="Deaths & funeral notices" title="Submit an announcement" intro="With care. We check every announcement with the family before anything is published." />
      <div className="mx-auto max-w-2xl px-5 py-8 sm:py-10">
        {!account ? (
          <div className="rounded-xl border border-line bg-paper p-6 shadow-soft">
            <h2 className="font-display text-2xl font-bold text-ink">Sign in to submit</h2>
            <p className="mt-2 text-ink-soft">We ask you to sign in so that we can reach you to check the details, and so that you can see where your announcement has got to, ask for a correction or withdraw it.</p>
            <p className="mt-4"><Link href="/sign-in?next=/notices/funeral/submit" className="inline-flex min-h-[44px] items-center rounded-pill bg-navy px-5 text-sm font-bold text-paper">Sign in to submit</Link></p>
          </div>
        ) : <FuneralSubmitForm areas={areas} />}
        <p className="mt-8 text-sm"><Link href="/notices/funeral" className="font-semibold text-navy-light underline">Back to funeral notices</Link></p>
      </div>
    </>
  );
}
