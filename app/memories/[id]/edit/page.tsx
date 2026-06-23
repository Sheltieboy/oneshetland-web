import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { getMemoryDetail, MEMORIES } from "@/lib/memories-data";
import { MemoryComposer, type EditableMemory } from "@/components/memories/MemoryComposer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit memory · OneShetland" };

export default async function EditMemoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const memory = await getMemoryDetail(id);
  if (!memory) notFound();
  const account = await getAccount();
  if (!account) redirect(`/sign-in?next=/memories/${id}/edit`);
  if (account.id !== memory.author_id) redirect(`/memories/${id}`);

  const existing: EditableMemory = {
    id: memory.id, title: memory.title, body: memory.body, place_name: memory.place_name,
    era: memory.era, tags: memory.tags ?? [], visibility: memory.visibility, lat: memory.lat, lng: memory.lng,
  };

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
      <Link href={`/memories/${id}`} className="text-sm font-semibold text-ink-soft hover:text-ink">← Back to memory</Link>
      <div className="mt-4">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: MEMORIES }}>OneShetland · Memories</p>
        <h1 className="mt-1 font-display text-4xl font-bold">Edit memory</h1>
        <p className="mt-2 text-lg text-ink-soft">Update the place, story or tags. Any photos, videos or voice notes you add here join the ones already on this memory.</p>
      </div>
      <div className="mt-8">
        <MemoryComposer isLoggedIn={!!account} existing={existing} />
      </div>
    </div>
  );
}
