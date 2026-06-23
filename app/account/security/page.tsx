import { getAccount } from "@/lib/auth";
import { SecurityForm } from "@/components/account/SecurityForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Security · OneShetland" };

export default async function Page() {
  const account = (await getAccount())!;
  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl font-bold text-ink">Security</h1>
      <p className="mt-1 text-ink-soft">Manage how you sign in to OneShetland.</p>
      <div className="mt-6">
        <SecurityForm currentEmail={account.email ?? ""} />
      </div>
    </div>
  );
}
