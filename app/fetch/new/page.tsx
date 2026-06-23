import Link from "next/link";
import { getAccount } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FETCH } from "@/lib/fetch-data";
import { RequestComposer } from "@/components/fetch/RequestComposer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Request a delivery · Fetch · OneShetland" };

export default async function NewRequestPage() {
  const account = await getAccount();
  let hasCard = false;
  if (account) {
    const sb = await createClient();
    const { data } = await sb.from("profiles").select("has_payment_method").eq("id", account.id).maybeSingle();
    hasCard = !!data?.has_payment_method;
  }
  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
      <Link href="/fetch" className="text-sm font-semibold text-ink-soft hover:text-ink">← Fetch</Link>
      <div className="mt-4 mb-8">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: FETCH }}>OneShetland · Fetch</p>
        <h1 className="mt-1 font-display text-4xl font-bold">Request a delivery</h1>
        <p className="mt-2 text-lg text-ink-soft">Tell us what to collect and where to bring it. A local driver heading your way will pick it up.</p>
      </div>
      <RequestComposer isLoggedIn={!!account} hasCard={hasCard} />
    </div>
  );
}
