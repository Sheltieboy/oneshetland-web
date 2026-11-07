import Link from "next/link";
import { START_HUB_HREF } from "@/lib/event-ownership";
import { HUB_SUGGESTION_BODY, HUB_SUGGESTION_CHECK, HUB_SUGGESTION_LINK, HUB_SUGGESTION_TITLE } from "@/lib/event-ownership-copy";

/** A gentle, skippable note. It blocks nothing and is shown only when shouldSuggestHub() says so. */
export function HubSuggestion() {
  return (
    <section aria-labelledby="hub-suggestion" className="mt-6 rounded-2xl border border-line-strong bg-paper p-5 text-ink">
      <h3 id="hub-suggestion" className="text-lg font-bold">{HUB_SUGGESTION_TITLE}</h3>
      <p className="mt-2 text-base">{HUB_SUGGESTION_BODY}</p>
      <p className="mt-2 text-base text-ink-soft">{HUB_SUGGESTION_CHECK}</p>
      <p className="mt-3"><Link href={START_HUB_HREF} className="inline-flex min-h-11 items-center text-base font-semibold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{HUB_SUGGESTION_LINK}</Link></p>
    </section>
  );
}
