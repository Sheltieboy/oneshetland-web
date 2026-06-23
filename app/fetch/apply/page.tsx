import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { FETCH } from "@/lib/fetch-data";
import { ApplyDriverForm } from "@/components/fetch/ApplyDriverForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Apply to drive · Fetch · OneShetland" };

export default async function ApplyDriverPage() {
  const account = await getAccount();
  if (!account) redirect("/sign-in?next=/fetch/apply");
  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
      <Link href="/fetch?tab=driver" className="text-sm font-semibold text-ink-soft hover:text-ink">← Fetch</Link>
      <div className="mt-4 mb-8">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: FETCH }}>OneShetland · Fetch</p>
        <h1 className="mt-1 font-display text-4xl font-bold">Apply to drive</h1>
        <p className="mt-2 text-lg text-ink-soft">Tell us about yourself and your vehicle. Applications are reviewed by our team — you can create runs once approved.</p>
      </div>
      <ApplyDriverForm />
    </div>
  );
}
