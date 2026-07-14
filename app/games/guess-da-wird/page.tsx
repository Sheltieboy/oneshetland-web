import Link from "next/link";
import { getAccount } from "@/lib/auth";
import { GuessDaWird } from "@/components/games/GuessDaWird";

export const dynamic = "force-dynamic";
export const metadata = { title: "Guess da Wird · Games" };

export default async function Page() {
  const account = await getAccount();
  return (
    <div className="min-h-[70vh] bg-cream">
      <div className="mx-auto max-w-md px-5 pt-6">
        <Link href="/games" className="text-sm font-semibold text-ink-soft hover:text-ink">← Games</Link>
        <h1 className="mt-2 text-center font-display text-3xl font-bold text-ink">Guess da Wird</h1>
      </div>
      <GuessDaWird userId={account?.id ?? null} />
    </div>
  );
}
