import Link from "next/link";
import { listAllArticles } from "@/lib/almanac-admin.server";
import { pillarMeta } from "@/lib/almanac-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Almanac · Admin" };

const STATUS_STYLE: Record<string, string> = {
  published: "bg-emerald-100 text-emerald-700",
  scheduled: "bg-amber-100 text-amber-700",
  draft: "bg-slate-100 text-slate-600",
  archived: "bg-slate-100 text-slate-400",
};

export default async function AdminAlmanacPage() {
  const articles = await listAllArticles();
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy">The Shetland Almanac</h1>
          <p className="text-sm text-ink-soft">{articles.length} article{articles.length === 1 ? "" : "s"}. Drafts stay hidden until scheduled or published.</p>
        </div>
        <Link href="/admin/almanac/new" className="rounded-pill bg-navy px-5 py-2 text-sm font-bold text-white hover:bg-navy-dark">+ New article</Link>
      </div>

      {articles.length === 0 ? (
        <div className="rounded-card border border-line bg-white p-10 text-center">
          <p className="font-display font-bold text-navy">No articles yet</p>
          <p className="mt-1 text-sm text-ink-soft">Create one and let Peerie Bot draft it from your dialect dictionary.</p>
          <Link href="/admin/almanac/new" className="mt-4 inline-block rounded-pill bg-teal px-5 py-2 text-sm font-bold text-white">Draft the first one</Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {articles.map((a) => {
            const pm = pillarMeta(a.pillar);
            return (
              <li key={a.id}>
                <Link href={`/admin/almanac/${a.id}`} className="flex items-center gap-3 rounded-card border border-line bg-white p-4 shadow-soft transition hover:bg-sand">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: pm.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{a.title || "(untitled)"}</p>
                    <p className="text-xs text-ink-muted">{pm.label} · /{a.slug}</p>
                  </div>
                  <span className={"shrink-0 rounded-pill px-2.5 py-0.5 text-xs font-bold " + (STATUS_STYLE[a.status] ?? "")}>{a.status}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
