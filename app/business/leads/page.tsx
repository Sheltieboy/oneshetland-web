import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FINDER_ANCHOR } from "@/lib/plan-cta";

/**
 * /business/leads — a shortcut to the right business's job-leads page.
 *
 * The real page is /business/[id]/manage/leads and it is only for that business's OWNER (an admin who does not own the
 * business is not let in either; ownership is checked there). This shortcut used to bounce anybody without a business to
 * the general For Businesses page with no explanation. Now: one business -> straight there; several -> choose; none ->
 * say plainly why, and what to do.
 */

export const dynamic = "force-dynamic";
export const metadata = { title: "Job leads", robots: { index: false, follow: false } };

export default async function LeadsShortcut() {
  const account = await getAccount();
  if (!account) redirect("/sign-in?next=/business/leads");

  const sb = await createClient();
  const { data } = await sb
    .from("local_businesses")
    .select("id, name")
    .eq("owner_id", account.id)
    .eq("is_active", true)
    .order("name")
    .limit(25);
  const mine = (data ?? []) as { id: string; name: string }[];

  if (mine.length === 1) redirect(`/business/${mine[0].id}/manage/leads`);

  return (
    <div className="mx-auto max-w-xl px-5 py-12">
      <h1 className="font-display text-3xl font-bold text-ink">Job leads</h1>
      {mine.length > 1 ? (
        <>
          <p className="mt-3 text-ink-soft">Which business are the job leads for?</p>
          <ul className="mt-4 space-y-2">
            {mine.map((b) => (
              <li key={b.id}>
                <Link href={`/business/${b.id}/manage/leads`} className="block rounded-xl border border-line bg-paper px-4 py-3 font-semibold text-ink shadow-soft hover:bg-sand/40">
                  {b.name}
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <p className="mt-3 text-ink-soft">
            Job leads belong to a business you manage, and the account you are signed in with doesn&apos;t manage one yet.
            Being an administrator doesn&apos;t give access to a business&apos;s leads.
          </p>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-ink-soft">
            <li>If your business is already listed, find it and claim it. Claims are checked by hand.</li>
            <li>If it isn&apos;t listed, add it.</li>
            <li>If you already manage a business, sign in with the account that owns it.</li>
          </ul>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={FINDER_ANCHOR} className="rounded-pill bg-navy px-5 py-2.5 text-sm font-bold text-white">Find and claim your listing</Link>
            <Link href="/directory/new" className="rounded-pill border border-line-strong px-5 py-2.5 text-sm font-semibold text-ink-soft hover:bg-sand">Add your business</Link>
          </div>
        </>
      )}
    </div>
  );
}
