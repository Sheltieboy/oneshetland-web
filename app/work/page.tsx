import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "My work" };

// "Account → Work": the personal MANAGEMENT area (your profile, applications and
// postings). This is distinct from the front-end /jobs hub, which is for
// BROWSING & applying. Mirrors the app's profile "Work" section.
const GROUPS: { title: string; items: { href: string; title: string; desc: string }[] }[] = [
  {
    title: "Looking for work",
    items: [
      { href: "/work-profile", title: "My work profile & CV", desc: "What employers see when you apply — jobs and shifts" },
      { href: "/jobs/applications", title: "My job applications", desc: "Jobs you've applied for, and their status" },
      { href: "/shifts/applications", title: "My shift applications", desc: "Shifts you've applied for, and check-in" },
      { href: "/jobs/saved", title: "Saved jobs", desc: "Jobs you've bookmarked" },
      { href: "/jobs", title: "Browse jobs & shifts", desc: "Find permanent roles and short shifts" },
    ],
  },
  {
    title: "Posting work",
    items: [
      { href: "/jobs/manage", title: "My posted jobs", desc: "Your jobs and who has applied" },
      { href: "/shifts/manage", title: "My posted shifts", desc: "Your shifts, applicants and check-in" },
      { href: "/jobs/new", title: "Post a job", desc: "Advertise a permanent or part-time role" },
      { href: "/shifts/new", title: "Post a shift", desc: "Advertise a short, same-day shift" },
      { href: "/work-profile/employer", title: "Business profile", desc: "What workers see when you post" },
    ],
  },
];

export default async function MyWorkPage() {
  const account = await getAccount();
  if (!account) redirect("/sign-in?next=/work");

  return (
    <div className="mx-auto max-w-4xl px-5 py-10 sm:py-14">
      <Link href="/account" className="text-sm font-semibold text-ink-soft hover:text-ink">← My account</Link>
      <h1 className="mt-3 font-display text-4xl font-bold">My work</h1>
      <p className="mt-2 text-ink-soft">Everything that's yours — your work profile, what you've applied for, and what you've posted. To browse and apply, use <Link href="/jobs" className="font-semibold underline">Work</Link>.</p>

      {GROUPS.map((g) => (
        <section key={g.title} className="mt-9">
          <h2 className="mb-3 font-display text-xl font-bold text-ink">{g.title}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {g.items.map((c) => (
              <Link key={c.href} href={c.href} className="rounded-card border border-line bg-paper p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
                <p className="font-display text-lg font-bold text-ink">{c.title}</p>
                <p className="mt-1 text-sm text-ink-soft">{c.desc}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
