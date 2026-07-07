import Link from "next/link";
import { getAccount } from "@/lib/auth";
import { MEMORIES } from "@/lib/memories-data";
import { MemoryComposer } from "@/components/memories/MemoryComposer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add a story · OneShetland" };

export default async function NewMemoryPage({ searchParams }: { searchParams: Promise<{ parent?: string }> }) {
  const { parent } = await searchParams;
  const account = await getAccount();
  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
      <Link href="/memories" className="text-sm font-semibold text-ink-soft hover:text-ink">← Auld Stories</Link>
      <div className="mt-4">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: MEMORIES }}>OneShetland · Auld Stories</p>
        <h1 className="mt-1 font-display text-4xl font-bold">{parent ? "Add to this story" : "Pin a story"}</h1>
        <p className="mt-2 text-lg text-ink-soft">Mark a place, tell its story, and leave a photo, video or voice note for folk to find.</p>
      </div>
      <div className="mt-8">
        <MemoryComposer isLoggedIn={!!account} parentId={parent} />
      </div>
    </div>
  );
}
