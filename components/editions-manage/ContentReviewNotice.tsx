"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { markContentNoticeChecked } from "@/app/organise/actions";
import type { ContentNotice } from "@/lib/editions/types";
import { Notice, btnQuiet } from "./kit";
import { useAction } from "./use-action";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

/**
 * A linked event moved; the Edition's own pages may still say the old thing.
 *
 * It warns and nothing else. It never edits a page, never hides one, never blocks saving or publishing, and the
 * organiser can leave it sitting there for ever. The page list is a plain text match on the wording that WAS true
 * ("29 November", "3.15pm", "Market Cross"), which is why it says "may need" rather than "needs": somebody who wrote
 * "a week on Sunday" is not going to be found, and somebody who wrote about a different 29 November will be.
 */
export function ContentReviewNotice({ notices, organiserSlug, editionSlug }: { notices: ContentNotice[]; organiserSlug: string; editionSlug: string }) {
  const router = useRouter();
  const done = useAction();
  if (!notices.length) return null;
  const pagesHref = `/organise/${organiserSlug}/editions/${editionSlug}/pages`;

  return (
    <section aria-labelledby="content-review-h" className="mb-6 rounded-card border border-amber-300 bg-amber-50 p-4 sm:p-5">
      <h2 id="content-review-h" className="font-display text-base font-bold text-amber-950">
        {notices.length === 1 ? "A listing moved — your own words may need a look" : `${notices.length} listings moved — your own words may need a look`}
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-amber-900">
        The programme updated itself. Anything you typed onto a page is yours, so it has been left exactly as you wrote it.
      </p>
      <ul className="mt-3 space-y-3">
        {notices.map((n) => (
          <li key={n.notice_id} className="rounded-card border border-amber-200 bg-paper/70 p-3">
            <p className="text-sm font-semibold text-ink">{n.title}</p>
            <p className="mt-0.5 text-sm text-ink-soft">
              <span className="line-through">{when(n.was_at)}{n.was_place ? `, ${n.was_place}` : ""}</span>
              {" → "}
              <strong className="text-ink">{when(n.now_at)}{n.now_place ? `, ${n.now_place}` : ""}</strong>
            </p>
            {n.pages.length > 0 ? (
              <>
                <p className="mt-2 text-sm text-ink-soft">{n.pages.length === 1 ? "This page still mentions the old details:" : "These pages still mention the old details:"}</p>
                <ul className="mt-1 flex flex-wrap gap-2">
                  {n.pages.map((p) => (
                    <li key={p.id}>
                      <Link href={`${pagesHref}?open=${p.id}`} className="inline-flex items-center gap-1.5 rounded-pill border border-line bg-paper px-3 py-1.5 text-sm font-semibold text-navy hover:bg-sand">
                        {p.title}
                        <span className="font-normal text-ink-muted">({p.matched.slice(0, 3).join(", ")}{p.matched.length > 3 ? "…" : ""})</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-2 text-sm text-ink-soft">
                None of your pages mention the old date, time or place in so many words — but a sentence can say it another way, so it is worth a read.
              </p>
            )}
            <div className="mt-2.5">
              <button type="button" className={btnQuiet} disabled={done.pending}
                onClick={() => done.run(() => markContentNoticeChecked(organiserSlug, editionSlug, n.notice_id), { onOk: () => router.refresh() })}>
                I&rsquo;ve checked these
              </button>
            </div>
          </li>
        ))}
      </ul>
      <Notice msg={done.msg} />
    </section>
  );
}
