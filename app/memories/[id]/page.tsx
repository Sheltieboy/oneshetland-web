import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { getMemoryDetail, fmtDate, authorName, CATEGORY_BY_SLUG, MEMORIES } from "@/lib/memories-data";
import { getMyReactions } from "@/lib/memories-data.server";
import { MemoryInteractions } from "@/components/memories/MemoryInteractions";
import { MemoryPhotoPins } from "@/components/memories/MemoryPhotoPins";
import { AudioTranscriber } from "@/components/memories/AudioTranscriber";
import { MemoryCard } from "@/components/memories/MemoriesUI";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await getMemoryDetail(id);
  return { title: m ? `${m.title || m.place_name || "A story"} · Auld Stories` : "Auld Stories" };
}

export default async function MemoryDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const memory = await getMemoryDetail(id);
  if (!memory) notFound();
  const account = await getAccount();
  const mine = account ? await getMyReactions(id) : [];
  const hero = (memory.media ?? []).find((m) => m.kind === "photo" || m.kind === "video");

  return (
    <>
      <section className="relative isolate overflow-hidden text-paper" style={{ background: MEMORIES }}>
        {hero?.kind === "photo" && <img src={hero.thumb_url || hero.url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />}
        <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${MEMORIES}f2, ${MEMORIES}aa 55%, ${MEMORIES}55)` }} />
        <div className="relative mx-auto max-w-3xl px-5 py-12 sm:py-14">
          <div className="flex items-center justify-between gap-3">
            <Link href="/memories" className="text-sm font-semibold text-paper/85 hover:text-paper">← Auld Stories</Link>
            {account?.id === memory.author_id && (
              <Link href={`/memories/${id}/edit`} className="rounded-pill bg-paper/20 px-4 py-1.5 text-sm font-semibold text-paper backdrop-blur hover:bg-paper/30">Edit</Link>
            )}
          </div>
          {memory.place_name && <p className="mt-3 text-xs font-bold uppercase tracking-widest text-paper/80">{memory.place_name}</p>}
          <h1 className="mt-1 font-display text-4xl font-bold sm:text-5xl">{memory.title || "A story"}</h1>
          <p className="mt-2 text-paper/85">{authorName(memory.author)} · {fmtDate(memory.created_at)}{memory.era ? ` · ${memory.era}` : ""}</p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-5 py-10 sm:py-12 space-y-8">
        {/* Tags */}
        {(memory.tags ?? []).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {(memory.tags ?? []).map((t) => (
              <span key={t} className="rounded-pill px-3 py-1 text-sm font-semibold" style={{ background: `${CATEGORY_BY_SLUG[t]?.color ?? MEMORIES}1a`, color: CATEGORY_BY_SLUG[t]?.color ?? MEMORIES }}>{CATEGORY_BY_SLUG[t]?.icon ?? ""} {CATEGORY_BY_SLUG[t]?.label ?? t}</span>
            ))}
          </div>
        )}

        {/* Story */}
        {memory.body && <p className="whitespace-pre-wrap text-lg leading-relaxed text-ink-soft">{memory.body}</p>}

        {/* Media */}
        {(memory.media ?? []).length > 0 && (
          <div className="space-y-4">
            {(memory.media ?? []).map((m) => (
              <div key={m.id} className="overflow-hidden rounded-card border border-line bg-paper shadow-soft">
                {m.kind === "photo" && (
                  <MemoryPhotoPins
                    mediaId={m.id} url={m.url} caption={m.caption} memoryId={id}
                    initialPins={(memory.pins ?? []).filter((p) => p.media_id === m.id)}
                    isAuthor={account?.id === memory.author_id} isLoggedIn={!!account} userId={account?.id ?? null}
                  />
                )}
                {m.kind === "video" && <video src={m.url} controls className="w-full" />}
                {m.kind === "audio" && (
                  <AudioTranscriber mediaId={m.id} url={m.url} durationSeconds={m.duration_seconds} initialStatus={m.transcript_status} initialTranscript={m.transcript} />
                )}
                {m.caption && m.kind !== "audio" && m.kind !== "photo" && <p className="px-4 py-2 text-sm text-ink-muted">{m.caption}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Reactions + comments */}
        <MemoryInteractions memoryId={id} counts={memory.reactions_by_kind ?? {}} mine={mine}
          comments={memory.comments ?? []} isLoggedIn={!!account} userId={account?.id ?? null} isAuthor={account?.id === memory.author_id} />

        {/* Add to memory */}
        <div className="rounded-card border border-line bg-paper p-5 text-center shadow-soft">
          <p className="font-display font-bold text-ink">Know more about this place?</p>
          <p className="mt-1 text-sm text-ink-muted">Add your own chapter — a photo, a voice note, or what you remember.</p>
          <Link href={`/memories/new?parent=${id}`} className="mt-3 inline-block rounded-pill px-5 py-2.5 text-sm font-semibold text-white" style={{ background: MEMORIES }}>Add to this story</Link>
        </div>

        {/* Sub-memories */}
        {(memory.children ?? []).length > 0 && (
          <section>
            <h2 className="mb-3 font-display text-xl font-bold text-ink">Added to this story · {memory.children!.length}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {memory.children!.map((c) => <MemoryCard key={c.id} m={c} />)}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
