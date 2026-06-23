import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { HUB_COLOR } from "@/lib/hubs-data";
import { HubForm } from "@/components/hubs/HubForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Start a hub" };

export default async function NewHubPage() {
  const account = await getAccount();
  if (!account) redirect("/sign-in?next=/hubs/new");

  return (
    <>
      <section className="text-paper" style={{ background: HUB_COLOR }}>
        <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
          <p className="eyebrow text-paper/80">Community</p>
          <h1 className="mt-2 font-display text-4xl font-bold sm:text-5xl">Start a hub</h1>
          <p className="mt-2 text-paper/90">A branded home for your club, group or organisation — free.</p>
        </div>
      </section>
      <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
        <HubForm />
      </div>
    </>
  );
}
