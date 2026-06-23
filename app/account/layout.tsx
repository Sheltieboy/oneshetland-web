import { redirect } from "next/navigation";
import { getAccount, accountName } from "@/lib/auth";
import { isBusinessOwner } from "@/lib/account-data.server";
import { AccountSidebar } from "@/components/account/AccountSidebar";

export const dynamic = "force-dynamic";
export const metadata = { title: "My account · OneShetland" };

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccount();
  if (!account) redirect("/sign-in?next=/account");
  const isAdmin = account.profile?.role === "admin";
  const isBusiness = await isBusinessOwner(account.id);
  const name = accountName(account);
  const initial = (name || "U").slice(0, 1).toUpperCase();

  return (
    <div className="min-h-screen bg-cream">
      <div className="bg-navy">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-6">
          <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-white/15 font-display text-2xl font-bold text-white">
            {account.profile?.avatar_url ? <img src={account.profile.avatar_url} alt="" className="h-full w-full object-cover" /> : initial}
          </div>
          <div className="min-w-0">
            <p className="font-display text-2xl font-bold text-white">{name}</p>
            <p className="text-sm text-white/70">{account.email}{isAdmin ? " · Admin" : ""}</p>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-6xl gap-8 px-5 py-8 lg:flex">
        <aside className="mb-6 shrink-0 lg:mb-0 lg:w-56"><AccountSidebar isAdmin={isAdmin} isBusiness={isBusiness} /></aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
