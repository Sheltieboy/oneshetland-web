import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { getMyBusinessesBasic } from "@/lib/account-data.server";
import { JOBS, EmptyState } from "@/components/jobs/JobsUI";

export const dynamic = "force-dynamic";
export const metadata = { title: "My posted jobs · Work" };

// Jobs are posted as a business, so managing them means picking the business
// whose applicants you want. This is the first-class "my posted jobs" entry the
// work hub links to (P2 can enrich it into a cross-business job list).
export default async function MyPostedJobsPage() {
  const account = await getAccount();
  if (!account) redirect("/sign-in?next=/jobs/manage");
  const businesses = await getMyBusinessesBasic(account.id);

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
      <Link href="/work" className="text-sm font-semibold text-ink-soft hover:text-ink">← My work</Link>
      <h1 className="mt-3 font-display text-4xl font-bold">My posted jobs</h1>
      <p className="mt-2 text-ink-soft">Jobs are posted under a business. Choose one to review its applicants and manage its roles.</p>

      <div className="mt-8">
        {businesses.length === 0 ? (
          <EmptyState
            icon="💼"
            title="No business yet"
            body="Jobs are advertised as a business. Register yours to post a role and receive applications."
            cta={{ label: "Register a business", href: "/directory/new", color: JOBS }}
          />
        ) : (
          <div className="space-y-2">
            {businesses.map((b) => (
              <Link
                key={b.id}
                href={`/business/${b.id}/manage/jobs`}
                className="flex items-center gap-3 rounded-card border border-line bg-paper px-4 py-3.5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
              >
                <div className="h-10 w-10 overflow-hidden rounded-lg bg-sand">{b.logo_url && <img src={b.logo_url} alt="" className="h-full w-full object-cover" />}</div>
                <span className="flex-1 font-display font-bold text-ink">{b.name}</span>
                <span className="text-sm font-semibold text-ink-faint">Manage jobs →</span>
              </Link>
            ))}
            <Link href="/jobs/new" className="mt-2 inline-block text-sm font-semibold text-ink-soft hover:underline">+ Post a new job</Link>
          </div>
        )}
      </div>
    </div>
  );
}
