import Link from "next/link";
import { getAccount } from "@/lib/auth";
import { BusinessCreateForm } from "@/components/directory/BusinessCreateForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add your business · Directory" };

const DIR = "#6b47bf";

export default async function NewBusinessPage() {
  const account = await getAccount();

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
      <Link
        href="/directory"
        className="inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"
        style={{ color: DIR }}
      >
        ← Directory
      </Link>

      <div className="mt-6">
        <p className="eyebrow" style={{ color: DIR }}>OneShetland</p>
        <h1 className="mt-1 font-display text-4xl font-bold">Add your business</h1>
        <p className="mt-3 text-lg text-ink-soft">
          Free to list. Reach everyone in Shetland with your business, offers, events and services.
        </p>
      </div>

      <div className="mt-8">
        <BusinessCreateForm isLoggedIn={!!account} />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3 text-center">
        {[
          { icon: "🏷️", title: "Free listing", body: "Your business page, live in minutes." },
          { icon: "🎁", title: "Offers & loyalty", body: "Add deals and reward returning customers." },
          { icon: "📅", title: "Events & jobs", body: "Publish events and job listings in one place." },
        ].map(f => (
          <div key={f.title} className="rounded-xl border border-line bg-paper p-5 shadow-soft">
            <p className="text-2xl">{f.icon}</p>
            <p className="mt-2 font-display font-bold text-ink">{f.title}</p>
            <p className="mt-1 text-sm text-ink-soft">{f.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
