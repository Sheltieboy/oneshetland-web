import Link from "next/link";
import {
  getWordsByLetter,
  getWordsByOrigin,
  getWordsByUsage,
  searchWords,
  getAlphabetInfo,
  getSpikStats,
  stripHtml,
  ALPHABET,
  SPIK_COLOR,
  type SpikListItem,
  type SpikStats,
} from "@/lib/spik-data";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Spik — the Shetland dialect dictionary",
  description:
    "The living Shetland dialect dictionary — thousands of wirds, with meanings and examples.",
};

const USAGE_BLURB: Record<string, string> = {
  common: "in everyday use across the isles",
  known: "widely recognised, if less spoken",
  "less common": "not commonly heard nowadays",
  rare: "seldom occurring or seen",
};

export default async function SpikPage({
  searchParams,
}: {
  searchParams: Promise<{ letter?: string; q?: string; origin?: string; usage?: string }>;
}) {
  const { letter: rawLetter, q, origin, usage } = await searchParams;
  const query = q?.trim() ?? "";
  const searching = query.length > 0;
  const filtering = !searching && (!!origin || !!usage);
  const letter = (rawLetter ?? "A").toUpperCase().slice(0, 1);
  const showStats = !searching && !filtering;

  const [{ total, letters }, stats, words] = await Promise.all([
    getAlphabetInfo(),
    getSpikStats(),
    searching
      ? searchWords(query)
      : origin
        ? getWordsByOrigin(origin)
        : usage
          ? getWordsByUsage(usage)
          : getWordsByLetter(letter),
  ]);

  const heading = searching
    ? `Results for “${query}”`
    : origin
      ? `${origin} wirds`
      : usage
        ? `${usage} wirds`
        : `${letter} wirds`;

  return (
    <>
      {/* Header band */}
      <section className="relative isolate overflow-hidden text-paper" style={{ background: SPIK_COLOR }}>
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(to top, ${SPIK_COLOR}f2, ${SPIK_COLOR}c0 60%, ${SPIK_COLOR}99)` }}
        />
        <div className="relative mx-auto max-w-6xl px-5 py-14 sm:py-16">
          <p className="eyebrow text-paper/85">OneShetland</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <h1 className="font-display text-5xl font-bold leading-none sm:text-6xl">Spik</h1>
            {total > 0 && (
              <div className="text-right">
                <div className="font-display text-3xl font-bold leading-none">
                  {total.toLocaleString("en-GB")}
                </div>
                <div className="text-sm text-paper/75">wirds an coontin</div>
              </div>
            )}
          </div>
          <p className="mt-4 max-w-xl text-lg text-paper/90">
            The living Shetland dialect dictionary — thousands of wirds, with
            meanings, pronunciations and examples.
          </p>
        </div>
      </section>

      {/* Sticky search + A–Z rail */}
      <div className="sticky top-16 z-30 border-b border-line bg-cream/90 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-5 py-3">
          <form action="/spik" method="get" className="mb-3 flex gap-2">
            <input
              name="q"
              defaultValue={query}
              placeholder="Search wirds…"
              className="w-full rounded-pill border border-line bg-paper px-5 py-2.5 text-ink shadow-soft outline-none placeholder:text-ink-faint focus:border-spik"
            />
            <button type="submit" className="rounded-pill px-5 py-2.5 font-semibold text-paper" style={{ background: SPIK_COLOR }}>
              Search
            </button>
          </form>
          <div className="-mx-5 flex gap-1 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {ALPHABET.map((l) => {
              const has = letters.has(l);
              const on = !searching && !filtering && l === letter;
              return (
                <Link
                  key={l}
                  href={`/spik?letter=${l}`}
                  aria-disabled={!has}
                  className={
                    "grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold transition " +
                    (on
                      ? "text-paper shadow-soft"
                      : has
                        ? "text-ink hover:bg-sand"
                        : "text-ink-faint pointer-events-none opacity-40")
                  }
                  style={on ? { background: SPIK_COLOR } : undefined}
                >
                  {l}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 py-12 sm:py-14">
        {/* Stats — only on the plain browse view */}
        {showStats && stats.total > 0 && <StatsBlock stats={stats} />}

        {/* Active filter chip */}
        {filtering && (
          <div className="mb-8 flex items-center gap-3">
            <span className="rounded-pill px-4 py-1.5 text-sm font-semibold text-paper" style={{ background: SPIK_COLOR }}>
              {origin ? `Origin: ${origin}` : `Usage: ${usage}`}
            </span>
            <Link href="/spik" className="text-sm font-semibold text-ink-muted underline-offset-2 hover:underline">
              Clear filter
            </Link>
          </div>
        )}

        <div className="mb-8 flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-bold capitalize">{heading}</h2>
          <p className="text-sm text-ink-muted">
            {words.length} wird{words.length === 1 ? "" : "s"}
          </p>
        </div>

        {words.length === 0 ? (
          <div className="rounded-xl border border-line bg-paper p-12 text-center shadow-soft">
            <h3 className="font-display text-xl font-bold">Naethin here yet</h3>
            <p className="mx-auto mt-2 max-w-md text-ink-soft">
              {searching
                ? "Nae wirds matched that search. Try anither spelling."
                : `Nae wirds tae show the noo.`}
            </p>
            <Link href="/spik?letter=A" className="mt-6 inline-block rounded-pill px-5 py-3 font-semibold text-paper" style={{ background: SPIK_COLOR }}>
              Back tae A
            </Link>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {words.map((w) => (
              <WordCard key={w.id} w={w} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

/* ── Stats block (origin breakdown + usage mix + how-to) ───────────────────── */

function StatsBlock({ stats }: { stats: SpikStats }) {
  // Drop the stray "Unknown"/odd rows, keep the meaningful buckets.
  const origins = stats.origins
    .filter((o) => o.count > 5)
    .sort((a, b) => b.count - a.count);
  const maxOrigin = Math.max(1, ...origins.map((o) => o.count));
  const USAGE_ORDER = ["common", "known", "less common", "rare"];
  const usage = USAGE_ORDER
    .map((level) => stats.usage.find((u) => u.level === level))
    .filter((u): u is { level: string; count: number } => !!u);

  return (
    <div className="mb-12 space-y-6">
      {/* Total + surprise */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-paper p-6 shadow-soft sm:p-7">
        <div>
          <div className="font-display text-4xl font-bold sm:text-5xl">
            {stats.total.toLocaleString("en-GB")}
          </div>
          <p className="mt-1 text-ink-muted">words in the Shetland dictionary</p>
        </div>
        <Link
          href="/spik/random"
          className="inline-flex items-center gap-2 rounded-pill px-5 py-3 font-semibold text-paper shadow-soft transition hover:brightness-95"
          style={{ background: SPIK_COLOR }}
        >
          <span aria-hidden>🎲</span> Surprise me
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Origin */}
        <div className="rounded-xl border border-line bg-paper p-6 shadow-soft">
          <h3 className="font-display text-xl font-bold">Origin</h3>
          <p className="mt-0.5 text-sm text-ink-muted">Tap a row to see those words</p>
          <div className="mt-5 space-y-4">
            {origins.map((o) => (
              <Link key={o.origin} href={`/spik?origin=${encodeURIComponent(o.origin)}`} className="group block">
                <div className="flex items-center justify-between">
                  <span className="font-semibold capitalize text-ink group-hover:text-spik">{o.origin}</span>
                  <span className="text-sm font-bold text-ink-soft">
                    {o.count.toLocaleString("en-GB")} <span aria-hidden className="text-ink-faint">›</span>
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-sand">
                  <div className="h-full rounded-full" style={{ width: `${(o.count / maxOrigin) * 100}%`, background: SPIK_COLOR }} />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Usage mix */}
        <div className="rounded-xl border border-line bg-paper p-6 shadow-soft">
          <h3 className="font-display text-xl font-bold">Usage mix</h3>
          <p className="mt-0.5 text-sm text-ink-muted">Tap a level to filter the dictionary</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {usage.map((u) => (
              <Link
                key={u.level}
                href={`/spik?usage=${encodeURIComponent(u.level)}`}
                className="group rounded-lg border border-line bg-cream/50 p-4 transition hover:border-spik"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold capitalize text-ink group-hover:text-spik">{u.level}</span>
                  <span className="font-display text-lg font-bold">{u.count.toLocaleString("en-GB")}</span>
                </div>
                <p className="mt-1 text-xs text-ink-muted">{USAGE_BLURB[u.level] ?? ""}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* How to use */}
      <div className="rounded-xl border border-spik/30 bg-spik/5 p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-paper" style={{ background: SPIK_COLOR }} aria-hidden>
            💡
          </span>
          <div>
            <h3 className="font-display text-lg font-bold">How to use Spik</h3>
            <p className="mt-1 text-ink-soft">
              Pick a letter above to jump into the dictionary, or search for a word.
              Open any full entry to see richer detail like pronunciation, example
              usage, alternate spelling and origin — and to suggest improvements.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function WordCard({ w }: { w: SpikListItem }) {
  const meaning = stripHtml(w.short_meaning);
  const example = stripHtml(w.example_sentence);
  return (
    <li>
      <Link
        href={`/spik/${w.id}`}
        className="group block h-full rounded-xl border border-line bg-paper p-4 shadow-soft transition hover:border-spik hover:shadow-md"
      >
        <div className="flex items-baseline gap-2">
          <span className="font-display text-xl font-bold text-ink group-hover:text-spik">
            {w.word}
          </span>
          {w.part_of_speech && (
            <span className="text-xs italic text-ink-muted">{w.part_of_speech}</span>
          )}
        </div>
        {w.pronunciation && (
          <p className="mt-0.5 text-sm text-ink-faint">/{stripHtml(w.pronunciation)}/</p>
        )}
        {meaning && <p className="mt-1.5 line-clamp-2 text-sm text-ink-soft">{meaning}</p>}
        {example && (
          <p className="mt-2 line-clamp-1 text-xs italic text-ink-muted">“{example}”</p>
        )}
      </Link>
    </li>
  );
}
