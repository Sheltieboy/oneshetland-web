import Link from "next/link";
import { getAccount } from "@/lib/auth";
import { SpikSprint } from "@/components/games/SpikSprint";

export const dynamic = "force-dynamic";
export const metadata = { title: "Spik Sprint · OneShetland Games" };

export default async function Page() {
  const account = await getAccount();
  return (
    <div className="min-h-[70vh] bg-cream">
      <div className="mx-auto max-w-xl px-5 pt-6"><Link href="/games" className="text-sm font-semibold text-ink-soft hover:text-ink">← Games</Link></div>
      <SpikSprint userId={account?.id ?? null} />
    </div>
  );
}
