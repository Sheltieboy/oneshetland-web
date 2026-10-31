import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicNotice } from "@/lib/notices-data";
import { NoticeCard } from "@/components/notices/NoticeCard";
import { Notice } from "@/components/notices/NoticesShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notice" };

/** One notice, in full. Read through the public RPC, so a notice that is not public (pending, withdrawn, resolved, expired, scheduled) is a 404. */
export default async function NoticeDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await getPublicNotice(id);
  if (r.ok && !r.data) notFound();
  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:py-12">
      <Link href="/notices" className="inline-flex min-h-[44px] items-center text-sm font-semibold text-navy-light underline">{"←"} All notices</Link>
      <div className="mt-3">
        {!r.ok && <Notice tone="error">This notice could not be loaded just now ({r.error}). Please try again.</Notice>}
        {r.ok && r.data && (
          <>
            {r.data.isEssential && <p className="mb-3 inline-block rounded-pill bg-[#9b1c1c] px-3 py-1 text-xs font-black uppercase tracking-widest text-white">Essential alert</p>}
            <NoticeCard n={r.data} variant="full" detail />
          </>
        )}
      </div>
    </div>
  );
}
