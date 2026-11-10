"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { submitEditionForReview, withdrawEditionSubmission } from "@/app/organise/actions";
import { missingRequired, type Readiness } from "@/lib/editions/rules";
import { ATTENTION_TEXT, STATE_LABEL, STATE_TONE, STEPS, dayLabelShort, editionState, historyLabel, needsAttention, nextAction, stepIndex, type EditionState, type ReviewStatus } from "@/lib/editions/journey";
import type { Edition, OrgRole } from "@/lib/editions/types";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { Notice, Pill, btnPrimary, btnQuiet, btnSecondary } from "./kit";
import { useAction } from "./use-action";
import { PublishButton } from "./StatusPanels";

/** One pill for the combined state of an Edition, in plain words. */
export function EditionStatePill({ edition, showAttention = false }: { edition: Pick<Edition, "status" | "review_state">; showAttention?: boolean }) {
  const s = editionState(edition);
  return (
    <>
      <Pill label={STATE_LABEL[s]} tone={STATE_TONE[s]} />
      {showAttention && needsAttention(s) && <span className="inline-block rounded-pill bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">{ATTENTION_TEXT}</span>}
    </>
  );
}

/** Draft, In review, Approved, Live. The current step is marked for screen readers as well as by colour. */
export function JourneyStepper({ state }: { state: EditionState }) {
  const cur = stepIndex(state);
  if (cur < 0) return null;
  return (
    <ol aria-label="Where your Edition is in the journey" className="grid grid-cols-4 gap-1.5 sm:gap-3">
      {STEPS.map((label, i) => {
        const done = i < cur, here = i === cur;
        return (
          <li key={label} aria-current={here ? "step" : undefined} className="min-w-0">
            <span aria-hidden className={"block h-1.5 rounded-full " + (done || here ? (here && state !== "live" ? "bg-teal" : "bg-navy") : "bg-line")} />
            <span className={"mt-1.5 block truncate text-xs sm:text-sm " + (here ? "font-bold text-ink" : done ? "font-semibold text-ink-soft" : "text-ink-muted")}>
              {label}{done && <span className="sr-only"> (done)</span>}{here && <span className="sr-only"> (you are here)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** What has happened to this Edition in review, newest first. */
export function ReviewHistory({ review }: { review: ReviewStatus }) {
  const rows = review.history.filter((h) => h.action !== "identity_verified");
  if (rows.length === 0) return <p className="text-sm text-ink-muted">Nothing yet. Once you send your Edition for review, each step appears here.</p>;
  return (
    <ol className="space-y-3 text-sm">
      {rows.map((h, i) => (
        <li key={`${h.at}-${i}`} className="border-l-2 border-line pl-3">
          <p className="font-semibold text-ink">{historyLabel(h.action)}</p>
          <p className="text-xs text-ink-muted">{dayLabelShort(h.at)}</p>
          {h.note && <p className="mt-1 whitespace-pre-line text-ink-soft">{h.note}</p>}
        </li>
      ))}
    </ol>
  );
}

type Props = { organiserSlug: string; edition: Edition; role: OrgRole; review: ReviewStatus; checklist: Readiness; entitled: boolean };

/** The heart of the overview: where the Edition stands and the ONE thing to do next. */
export function ReviewPanel({ organiserSlug, edition, role, review, checklist, entitled }: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const { pending, msg, run } = useAction();
  const missing = missingRequired(checklist);
  const ready = checklist.length > 0 && missing.length === 0;
  const n = nextAction({ status: edition.status, review_state: edition.review_state, entitled, role, ready, material: review.material });
  const root = `/organise/${organiserSlug}/editions/${edition.slug}`;
  const done = () => router.refresh();

  const submit = (success: string) => run(() => submitEditionForReview(organiserSlug, edition.slug), { success, onOk: done });
  async function withdraw() {
    if (await confirm({ title: "Take it back from review?", body: "OneShetland will stop looking at it and it goes back to a draft. You can send it again whenever you are ready.", confirmLabel: "Take it back" }))
      run(() => withdrawEditionSubmission(organiserSlug, edition.slug), { success: "Taken back. It is a draft again.", onOk: done });
  }

  const tone = n.state === "changes_requested" ? "border-amber-300 bg-amber-50" : n.state === "rejected" || n.state === "suspended" ? "border-rose-200 bg-rose-50/70" : n.state === "live" ? "border-emerald-200 bg-emerald-50/70" : "border-line bg-paper";
  const showMessage = n.state === "changes_requested" || n.state === "rejected";
  const blocked = (n.key === "finish_checklist" || n.key === "submit" || n.key === "fix_changes" || n.key === "fix_rejected") && !ready;

  return (
    <section aria-labelledby="next-h" className={`rounded-card border p-5 shadow-soft ${tone}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">{STATE_LABEL[n.state]}</p>
      <h2 id="next-h" className="mt-1 font-display text-2xl font-bold text-ink">{n.headline}</h2>
      <p className="mt-1.5 text-sm text-ink-soft">{n.detail}</p>

      {showMessage && (
        <div role="note" className={"mt-4 rounded-xl border p-4 " + (n.state === "rejected" ? "border-rose-200 bg-paper" : "border-amber-300 bg-paper")}>
          <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Message from OneShetland{review.last_at ? ` · ${dayLabelShort(review.last_at)}` : ""}</p>
          <p className="mt-1 whitespace-pre-line text-base font-medium text-ink">{review.last_note || "OneShetland did not leave a message. Please check the details, pages and programme, then send it again."}</p>
          <p className="mt-2 text-xs text-ink-muted">Make the changes on the <Link href={`${root}/details`} className="font-semibold underline">Details</Link>, <Link href={`${root}/pages`} className="font-semibold underline">Pages</Link> or <Link href={`${root}/programme`} className="font-semibold underline">Programme</Link> tabs.</p>
        </div>
      )}
      {(n.state === "in_review") && review.submitted_at && <p className="mt-3 text-sm text-ink">Sent for review on <span className="font-semibold">{dayLabelShort(review.submitted_at)}</span>.</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        {(n.primary === "submit" || n.primary === "resubmit") && (
          <button type="button" className={btnPrimary} disabled={pending || !n.canAct || !ready} onClick={() => submit(n.primary === "resubmit" ? "Sent back to OneShetland for review." : "Sent to OneShetland for review. We will email you with the decision.")}>
            {pending ? "Sending…" : n.primary === "resubmit" ? "Resubmit for review" : "Submit for review"}
          </button>
        )}
        {n.primary === "withdraw" && n.canAct && <button type="button" className={btnSecondary} disabled={pending} onClick={withdraw}>Withdraw from review</button>}
        {n.primary === "choose_package" && n.canAct && <Link href={`${root}/package`} className={btnPrimary}>Choose a package</Link>}
        {n.primary === "choose_package" && !n.canAct && <Link href={`${root}/package`} className={btnSecondary}>See the packages</Link>}
        {n.primary === "publish" && <PublishButton organiserSlug={organiserSlug} edition={edition} canAct={n.canAct} entitled={entitled} />}
        {n.primary === "view_live" && <Link href={`/editions/${edition.slug}`} className={btnPrimary} target="_blank" rel="noopener">View your public page</Link>}
        {n.primary === "view_live" && <span className="text-sm text-ink-soft">oneshetland.com/editions/{edition.slug}</span>}
        {n.state === "approved" && !entitled && n.canAct && <Link href={`${root}/package`} className={btnQuiet + " inline-flex min-h-[44px] items-center"}>Compare packages</Link>}
      </div>
      {n.ownerOnlyNote && <p className="mt-3 text-sm text-ink-soft">{n.ownerOnlyNote}</p>}
      {blocked && n.canAct && (
        <p className="mt-3 text-sm text-ink-soft" id="blocked-why">
          {checklist.length === 0 ? "The checklist could not be loaded. Refresh the page to try again." : <>Still to do before you can submit: <span className="font-semibold text-ink">{missing.map((m) => m.label).join(", ")}</span>.</>}
        </p>
      )}
      <div className="mt-3"><Notice msg={msg} /></div>
    </section>
  );
}
