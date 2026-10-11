import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin-data.server";
import { loadAdminOverview } from "@/lib/launch-testing/data.server";
import { AdminHeader, Empty } from "@/components/admin/AdminUI";
import { AdminTabs } from "@/components/launch-testing/AdminTabs";
import { AddTester, TesterRow } from "@/components/launch-testing/TesterManager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Launch testing · testers", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ programme?: string }> }) {
  await requireAdmin();
  const { programme: slug } = await searchParams;
  const o = await loadAdminOverview(slug);
  return (
    <>
      <AdminHeader title="Launch testing" sub="Who can open the Test Centre. Only people you add here can see it." />
      <AdminTabs programme={o.programme?.slug} />
      {!o.programme ? <Empty>No test programme was found.</Empty> : (
        <div className="space-y-6">
          <AddTester programmeId={o.programme.id} />
          <section>
            <h2 className="mb-3 font-display text-lg font-bold text-ink">Testers ({o.testers.length})</h2>
            {o.testers.length === 0 ? <Empty>No testers yet.</Empty> : <ul className="space-y-3">{o.testers.map((t) => <TesterRow key={t.tester_id} tester={t} />)}</ul>}
          </section>
          <p className="text-sm text-ink-muted">Testers reach the Test Centre at <code className="rounded bg-sand px-1">oneshetland.com/launch-testing</code> after signing in with their normal account. Turning “Access enabled” off closes it for them at once; their earlier results are kept.</p>
        </div>
      )}
    </>
  );
}
