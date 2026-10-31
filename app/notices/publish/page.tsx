import Link from "next/link";
import { getAccount } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { callRpc } from "@/lib/notices-rpc";
import { getAreaOptions } from "@/lib/notices-data";
import type { OfficialNoticeRow } from "@/lib/notices-alerts";
import { PublisherConsole, type MyPublisher } from "@/components/notices/PublisherConsole";
import { Notice, NoticesHeader } from "@/components/notices/NoticesShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Publish a notice", robots: { index: false } };

/** Visible only to members of a verified organisation (my_official_publishers returns rows). Everyone else gets a plain "not available" page. */
export default async function PublishPage() {
  const account = await getAccount();
  const r = account ? await callRpc<MyPublisher[]>(await createClient(), "my_official_publishers") : null;
  const publishers = r && r.ok && Array.isArray(r.data) ? r.data.filter((p) => p.can_publish) : [];
  const areas = publishers.length ? await getAreaOptions() : [];
  // Every state (scheduled, resolved, withdrawn included) for each organisation the member publishes for.
  const mineByPub: Record<string, OfficialNoticeRow[]> = {};
  let listError: string | null = null;
  if (publishers.length) {
    const sb = await createClient();
    for (const p of publishers) {
      const x = await callRpc<OfficialNoticeRow[]>(sb, "my_official_notices", { p_publisher: p.publisher_id });
      if (x.ok) mineByPub[p.publisher_id] = Array.isArray(x.data) ? x.data : []; else { mineByPub[p.publisher_id] = []; listError = x.error; }
    }
  }

  return (
    <>
      <NoticesHeader eyebrow="Verified organisations" title="Publish a notice" />
      <div className="mx-auto max-w-3xl px-5 py-8 sm:py-10">
        {!account && <Notice>Please <Link className="font-semibold underline" href="/sign-in?next=/notices/publish">sign in</Link> to continue.</Notice>}
        {account && r && !r.ok && <Notice tone="error">We could not check your access just now ({r.error}). Please try again.</Notice>}
        {account && r && r.ok && publishers.length === 0 && (
          <div className="rounded-xl border border-line bg-paper p-6 shadow-soft">
            <h2 className="font-display text-2xl font-bold text-ink">This page is not available</h2>
            <p className="mt-2 text-ink-soft">Publishing official notices is open to verified organisations such as the council and NHS Shetland. If you represent one and need access, please contact us through the support page.</p>
            <p className="mt-4"><Link href="/notices" className="font-semibold text-navy-light underline">Back to notices</Link></p>
          </div>
        )}
        {publishers.length > 0 && <PublisherConsole publishers={publishers} areas={areas.map((a) => ({ id: a.id, name: a.name }))} mine={mineByPub} listError={listError} />}
      </div>
    </>
  );
}
