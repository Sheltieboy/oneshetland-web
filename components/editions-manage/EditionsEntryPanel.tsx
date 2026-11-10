"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { btnPrimary, Notice } from "./kit";
import { useAction } from "./use-action";

export type EntryState = { slug: string; editions: number; inReview: number } | null;
type Start = (parentId: string) => Promise<{ ok: true; slug: string } | { ok: false; error: string }>;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** One short sentence about where a Business or Hub stands with Editions. */
export function entryStateText(s: EntryState): string {
  if (!s) return "Not started";
  if (s.editions === 0) return "Ready: no Editions yet";
  return s.inReview > 0 ? `${plural(s.editions, "Edition", "Editions")} · ${s.inReview} in review` : plural(s.editions, "Edition", "Editions");
}

/**
 * "Run your own festivals and Editions", the same for a Business owner and for a Hub's owner or committee. One primary button: start Editions for the Business or Hub (nothing to
 * name, nothing to register, no web address to choose), or open the Editions tools if they are already started.
 */
export function EditionsEntryPanel({ kind, parentId, parentName, state, start }: { kind: "hub" | "business"; parentId: string; parentName: string; state: EntryState; start: Start }) {
  const router = useRouter();
  const go = useAction();
  const card = "rounded-card border border-line bg-paper p-5 shadow-soft";
  const who = kind === "hub" ? "Hub" : "Business";
  if (state) {
    return (
      <section aria-labelledby="own-h" className={card}>
        <h2 id="own-h" className="font-display text-xl font-bold text-ink">Run your own festivals and Editions</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          {state.editions === 0 ? "You have not made an Edition yet." : `${plural(state.editions, "Edition", "Editions")} so far${state.inReview > 0 ? `, ${state.inReview} waiting for OneShetland to review` : ""}.`}{" "}
          They use {parentName}&rsquo;s name and logo, and {kind === "hub" ? "your committee manages them" : "you manage them"} with the access you already have.
        </p>
        <div className="mt-4"><Link href={`/organise/${state.slug}`} className={btnPrimary}>Open Editions tools</Link></div>
      </section>
    );
  }
  return (
    <section aria-labelledby="own-h" className={card}>
      <h2 id="own-h" className="font-display text-xl font-bold text-ink">Run your own festivals and Editions</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-soft">
        A festival, a show, a season or a campaign with its own page, programme and journal, run by {parentName}. It uses your {who}&rsquo;s name and logo, so there is nothing to register.
        You can build and preview in private, and OneShetland checks each Edition before it goes public.
      </p>
      <div className="mt-4">
        <button type="button" className={btnPrimary} disabled={go.pending} onClick={() => go.run(() => start(parentId), { onOk: (r) => { router.push(`/organise/${r.slug}`); router.refresh(); } })}>
          {go.pending ? "Setting up…" : `Start Editions for ${parentName}`}
        </button>
      </div>
      <div className="mt-3"><Notice msg={go.msg} /></div>
    </section>
  );
}
