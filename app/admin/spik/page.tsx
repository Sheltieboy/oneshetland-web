import Link from "next/link";
import { getSpikSuggestions, getSpikWordSubmissions, getSpikWordVariations } from "@/lib/admin-data.server";
import { AdminHeader, Empty } from "@/components/admin/AdminUI";
import { SpikSuggestions } from "@/components/admin/SpikSuggestions";
import { SpikWordSubmissions } from "@/components/admin/SpikWordSubmissions";
import { SpikVariationSubmissions } from "@/components/admin/SpikVariationSubmissions";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const filter = (status === "reviewed" || status === "all" ? status : "pending") as "pending" | "reviewed" | "all";
  const [rows, newWords, variations] = await Promise.all([
    getSpikSuggestions(filter),
    getSpikWordSubmissions("pending"),
    getSpikWordVariations("pending"),
  ]);
  const tabs: [string, string][] = [["pending", "Pending"], ["reviewed", "Reviewed"], ["all", "All"]];

  return (
    <>
      <AdminHeader title="Spik" sub="Community contributions to the Shetland dialect dictionary." />

      {/* New words submitted by the community — approve to publish live */}
      <h2 className="mb-3 font-display text-xl font-bold text-ink">
        New words submitted
        {newWords.length ? <span className="ml-2 rounded-pill bg-rose-600 px-2 py-0.5 align-middle text-sm text-white">{newWords.length}</span> : null}
      </h2>
      {newWords.length === 0
        ? <Empty>No new words waiting for review.</Empty>
        : <SpikWordSubmissions rows={newWords as never[]} />}

      {/* Local variations submitted by the community — approve to show on the word page */}
      <h2 className="mb-3 mt-10 font-display text-xl font-bold text-ink">
        Local variations submitted
        {variations.length ? <span className="ml-2 rounded-pill bg-rose-600 px-2 py-0.5 align-middle text-sm text-white">{variations.length}</span> : null}
      </h2>
      {variations.length === 0
        ? <Empty>No local variations waiting for review.</Empty>
        : <SpikVariationSubmissions rows={variations as never[]} />}

      {/* Edits suggested for existing words */}
      <h2 className="mb-3 mt-10 font-display text-xl font-bold text-ink">Edits to existing words</h2>
      <div className="mb-5 flex gap-2">
        {tabs.map(([k, label]) => (
          <Link key={k} href={`/admin/spik?status=${k}`} className={"rounded-pill px-4 py-1.5 text-sm font-semibold " + (filter === k ? "bg-rose-600 text-white" : "border border-line-strong text-ink-soft hover:bg-sand")}>{label}</Link>
        ))}
      </div>
      {rows.length === 0 ? <Empty>Nothing here.</Empty> : <SpikSuggestions rows={rows as never[]} />}
    </>
  );
}
