import Link from "next/link";
import { AddBoatForm } from "@/components/boats/AddBoatForm";
import { BOATS } from "@/lib/boats-data";

export const metadata = { title: "Add a boat · Da Boats" };

export default function AddBoatPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Link href="/boats" className="text-sm font-semibold text-ink-muted underline-offset-2 hover:underline">← Back to Da Boats</Link>
      <div className="mt-4">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: BOATS }}>Da Boats · the Shetland fleet</p>
        <h1 className="mt-1 font-display text-4xl font-bold text-ink">Add a boat</h1>
        <p className="mt-3 text-lg text-ink-soft">
          Ken a Shetland boat that&apos;s no in Da Boats yet? Add her here. A moderator checks every new boat before it goes live.
        </p>
      </div>
      <div className="mt-8">
        <AddBoatForm />
      </div>
    </div>
  );
}
