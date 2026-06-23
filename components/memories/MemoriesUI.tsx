import Link from "next/link";
import { type MemoryPin, CATEGORY_BY_SLUG, MEMORIES } from "@/lib/memories-data";

export function MemoryCard({ m }: { m: MemoryPin }) {
  return (
    <Link href={`/memories/${m.id}`} className="group flex flex-col overflow-hidden rounded-card border border-line bg-paper shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-lift">
      <div className="relative h-40 overflow-hidden" style={{ background: `${MEMORIES}14` }}>
        {m.hero_url ? (
          <img src={m.hero_url} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
        ) : (
          <div className="grid h-full w-full place-items-center text-5xl opacity-25">📍</div>
        )}
        {m.hero_kind === "video" && <span className="absolute inset-0 grid place-items-center text-4xl text-white/90">▶</span>}
      </div>
      <div className="flex flex-1 flex-col p-4">
        {m.place_name && <p className="text-xs font-bold uppercase tracking-widest" style={{ color: MEMORIES }}>{m.place_name}</p>}
        <h3 className="mt-0.5 font-display text-lg font-bold leading-tight text-ink group-hover:underline">{m.title || "A memory"}</h3>
        {m.era && <p className="mt-0.5 text-sm text-ink-muted">{m.era}</p>}
        {(m.tags ?? []).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {(m.tags ?? []).slice(0, 3).map((t) => (
              <span key={t} className="rounded-pill bg-sand px-2 py-0.5 text-xs font-semibold text-ink-soft">{CATEGORY_BY_SLUG[t]?.icon ?? ""} {CATEGORY_BY_SLUG[t]?.label ?? t}</span>
            ))}
          </div>
        )}
        <p className="mt-auto pt-3 text-xs text-ink-faint">
          {(m.media_count ?? 0) > 0 ? `📷 ${m.media_count} · ` : ""}{(m.comment_count ?? 0) > 0 ? `💬 ${m.comment_count} · ` : ""}{(m.reaction_count ?? 0) > 0 ? `❤️ ${m.reaction_count}` : ""}
        </p>
      </div>
    </Link>
  );
}
