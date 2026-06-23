import Link from "next/link";
import { notFound } from "next/navigation";
import { getWord, stripHtml, SUGGEST_FIELDS, SPIK_COLOR } from "@/lib/spik-data";
import { SuggestModal } from "@/components/spik/SuggestModal";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const w = await getWord(id);
  if (!w) return { title: "Wird" };
  const meaning = stripHtml(w.short_meaning);
  return {
    title: `${w.word} — Spik`,
    description: meaning || `${w.word} in the Shetland dialect dictionary.`,
  };
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-pill border border-line bg-cream/60 px-3 py-1 text-sm font-semibold capitalize text-ink-soft">
      {children}
    </span>
  );
}

function SnapshotTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-line bg-cream/40 p-4">
      <div className="font-display text-xl font-bold capitalize" style={{ color: SPIK_COLOR }}>
        {value}
      </div>
      <div className="mt-0.5 text-sm text-ink-muted">{label}</div>
    </div>
  );
}

export default async function WordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const w = await getWord(id);
  if (!w) notFound();

  const shortMeaning = stripHtml(w.short_meaning);
  const fullMeaning = stripHtml(w.spik_meaning);
  const example = stripHtml(w.example_sentence);
  const pronunciation = stripHtml(w.pronunciation);
  const alternate = stripHtml(w.alternate_spelling);
  const firstLetter = (w.first_letter ?? w.word.slice(0, 1)).toUpperCase();
  const contextChips = [w.origin, w.era, w.tone].map(stripHtml).filter(Boolean);

  const current: Record<string, string> = {};
  for (const f of SUGGEST_FIELDS) {
    current[f.name] = stripHtml((w as unknown as Record<string, string | null>)[f.name]);
  }

  return (
    <>
      {/* Header band */}
      <section className="relative isolate overflow-hidden text-paper" style={{ background: SPIK_COLOR }}>
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(to top, ${SPIK_COLOR}f2, ${SPIK_COLOR}c0 60%, ${SPIK_COLOR}99)` }}
        />
        <div className="relative mx-auto max-w-3xl px-5 py-12 sm:py-14">
          <Link
            href={`/spik?letter=${firstLetter}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-paper/85 transition hover:text-paper"
          >
            <span aria-hidden>←</span> Spik dictionary
          </Link>
          <h1 className="mt-3 font-display text-5xl font-bold leading-none sm:text-6xl">
            {w.word}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {w.part_of_speech && (
              <span className="rounded-pill bg-paper/20 px-3 py-1 text-xs font-bold uppercase tracking-wide">
                {w.part_of_speech}
              </span>
            )}
            {w.category && (
              <span className="rounded-pill bg-paper/10 px-3 py-1 text-xs font-semibold capitalize text-paper/90">
                {stripHtml(w.category)}
              </span>
            )}
          </div>
          {shortMeaning && <p className="mt-4 text-xl font-semibold text-paper">{shortMeaning}</p>}
          {fullMeaning && fullMeaning !== shortMeaning && (
            <p className="mt-2 max-w-xl leading-relaxed text-paper/90">{fullMeaning}</p>
          )}
        </div>
      </section>

      <article className="mx-auto max-w-3xl space-y-8 px-5 py-12 sm:py-14">
        {/* Example */}
        {example && (
          <div className="rounded-xl border border-line bg-paper p-6 shadow-soft">
            <p className="eyebrow text-ink-muted">Example in use</p>
            <blockquote
              className="mt-3 border-l-4 pl-4 text-lg italic text-ink-soft"
              style={{ borderColor: SPIK_COLOR }}
            >
              “{example}”
            </blockquote>
          </div>
        )}

        {/* Pronunciation */}
        {pronunciation && (
          <div className="rounded-xl border border-line bg-paper p-6 shadow-soft">
            <p className="eyebrow text-ink-muted">Pronunciation</p>
            <p className="mt-1 text-sm text-ink-faint">Say it like this</p>
            <span
              className="mt-3 inline-block rounded-pill px-4 py-1.5 font-display text-lg font-bold"
              style={{ background: `${SPIK_COLOR}22`, color: SPIK_COLOR }}
            >
              /{pronunciation}/
            </span>
          </div>
        )}

        {/* Word snapshot */}
        <div className="rounded-xl border border-line bg-paper p-6 shadow-soft">
          <p className="eyebrow text-ink-muted">Word snapshot</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <SnapshotTile value={pronunciation ? "Yes" : "No"} label="pronunciation added" />
            <SnapshotTile value={alternate ? "1" : "0"} label="known variants" />
            <SnapshotTile value={stripHtml(w.usage_level) || "—"} label="usage level" />
            <SnapshotTile value={stripHtml(w.origin) ? "Set" : "—"} label="origin detail" />
          </div>
        </div>

        {/* Origin & context */}
        {(contextChips.length > 0 || alternate || stripHtml(w.speaker_area)) && (
          <div className="rounded-xl border border-line bg-paper p-6 shadow-soft">
            <p className="eyebrow text-ink-muted">Origin &amp; context</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {contextChips.map((c) => (
                <Chip key={c}>{c}</Chip>
              ))}
              {alternate && <Chip>also: {alternate}</Chip>}
              {stripHtml(w.speaker_area) && <Chip>{stripHtml(w.speaker_area)}</Chip>}
            </div>
          </div>
        )}

        {/* Notes */}
        {stripHtml(w.notes) && (
          <div className="rounded-xl border border-line bg-sand/40 p-6">
            <p className="eyebrow text-ink-muted">Notes</p>
            <p className="mt-2 text-ink-soft">{stripHtml(w.notes)}</p>
          </div>
        )}

        {/* Audio */}
        {w.audio_url && (
          <div>
            <p className="eyebrow text-ink-muted">Hear it</p>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio controls src={w.audio_url} className="mt-2 w-full" />
          </div>
        )}

        {/* Make a suggestion (opens a modal) */}
        <SuggestModal wordId={w.id} word={w.word} pos={w.part_of_speech} current={current} />

        <div>
          <Link
            href={`/spik?letter=${firstLetter}`}
            className="inline-flex items-center gap-1.5 rounded-pill border border-line-strong px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-sand"
          >
            <span aria-hidden>←</span> More {firstLetter} wirds
          </Link>
        </div>
      </article>
    </>
  );
}
