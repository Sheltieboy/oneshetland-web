import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { getFuneralNotice } from "@/lib/notices-data";
import { ChangeRequestForm } from "@/components/notices/FuneralForms";
import { FuneralAnnouncement } from "@/components/notices/FuneralNotice";
import { Notice } from "@/components/notices/NoticesShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Funeral announcement" };

export default async function FuneralDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [r, account] = await Promise.all([getFuneralNotice(id), getAccount()]);
  if (r.ok && !r.data) notFound();
  return (
    <div className="px-5 py-8 sm:py-12" style={{ background: "#ece5d6" }}>
      <div className="mx-auto max-w-2xl">
        <Link href="/notices/funeral" className="inline-flex min-h-[44px] items-center text-sm font-semibold underline" style={{ color: "#2b3a47" }}>{"←"} Funeral notices</Link>
        <div className="mt-3">
          {!r.ok && <Notice tone="error">This announcement could not be loaded just now ({r.error}). Please try again.</Notice>}
          {r.ok && r.data && <FuneralAnnouncement v={r.data} />}
        </div>
        {r.ok && r.data && (
          <section className="mt-6 rounded-sm border bg-white/60 px-5 py-4" style={{ borderColor: "#cdbfa6", color: "#2b3a47" }}>
            <h2 className="text-sm font-semibold">Is something here wrong, or would the family like it removed?</h2>
            <p className="mt-1 text-sm">You do not need an account. We check every request before anything changes.</p>
            <p className="mt-3"><Link href={`/notices/funeral/${id}/contact`} className="inline-flex min-h-[44px] items-center rounded-pill border border-line-strong bg-paper px-5 text-sm font-semibold underline">Contact us about this announcement</Link></p>
            {account && <details className="mt-3"><summary className="flex min-h-[44px] cursor-pointer items-center text-sm font-semibold">Signed in? Send a request from your account</summary><div className="pb-3 pt-2"><ChangeRequestForm id={id} signedIn nextPath={`/notices/funeral/${id}`} /></div></details>}
          </section>
        )}
      </div>
    </div>
  );
}
