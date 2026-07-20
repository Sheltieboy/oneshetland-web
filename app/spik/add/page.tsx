import Link from "next/link";
import { AddWordForm } from "@/components/spik/AddWordForm";
import { SPIK_COLOR } from "@/lib/spik-data";

export const metadata = { title: "Add a word · Spik" };

export default function AddWordPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Link href="/spik" className="text-sm font-semibold text-ink-muted underline-offset-2 hover:underline">← Back to Spik</Link>
      <div className="mt-4">
        <p className="eyebrow" style={{ color: SPIK_COLOR }}>Spik · the Shetland dialect</p>
        <h1 className="mt-1 font-display text-4xl font-bold text-ink">Add a word</h1>
        <p className="mt-3 text-lg text-ink-soft">
          Ken a Shetland word that&apos;s no in Spik yet? Add it here — fill in as much as you can.
          A moderator checks every new word before it goes live.
        </p>
      </div>
      <div className="mt-8">
        <AddWordForm />
      </div>
    </div>
  );
}
