import Link from "next/link";
import { getAccount } from "@/lib/auth";
import { MapIt } from "@/components/games/MapIt";

export const dynamic = "force-dynamic";
export const metadata = { title: "Map It · OneShetland Games" };

export default async function Page() {
  const account = await getAccount();
  return (
    <div className="min-h-[70vh] bg-cream">
      <div className="mx-auto max-w-md px-5 pt-6"><Link href="/games" className="text-sm font-semibold text-ink-soft hover:text-ink">← Games</Link></div>
      <MapIt userId={account?.id ?? null} />
    </div>
  );
}
