import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin-data.server";
import { loadAdminOverview } from "@/lib/launch-testing/data.server";
import { AdminHeader, Empty } from "@/components/admin/AdminUI";
import { AdminTabs } from "@/components/launch-testing/AdminTabs";
import { TestEditor } from "@/components/launch-testing/TestEditor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Launch testing · tests", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ programme?: string }> }) {
  await requireAdmin();
  const { programme: slug } = await searchParams;
  const o = await loadAdminOverview(slug);
  return (
    <>
      <AdminHeader title="Launch testing" sub="Set the wording, the product to buy, the Hub to donate to and the most anyone should spend." />
      <AdminTabs programme={o.programme?.slug} />
      {!o.programme ? <Empty>No test programme was found.</Empty> : (
        <div className="space-y-3">
          {o.tests.map((t) => <TestEditor key={`${t.id}-${t.sort_order}-${t.title}`} test={t} number={o.numbers.get(t.id) ?? null} />)}
          <p className="pt-2 text-sm text-ink-muted">The Test Centre only <em>describes</em> these journeys. The purchases and donation happen in the live app, with the live payment system — nothing here can take or refund money.</p>
        </div>
      )}
    </>
  );
}
