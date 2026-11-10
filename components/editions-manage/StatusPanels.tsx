"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { deleteEdition, setEditionStatus } from "@/app/organise/actions";
import { can, type Readiness } from "@/lib/editions/rules";
import { canPublishNow, publishBlockers } from "@/lib/editions/journey";
import type { Edition, OrgRole } from "@/lib/editions/types";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { Notice, btnDanger, btnPrimary, btnSecondary } from "./kit";
import { useAction } from "./use-action";

/** Where to go to fix each unmet checklist item, so an owner never has to guess which tab. */
const FIX_LABEL: Record<string, string> = { summary: "Add a summary", dates: "Change the dates", cover: "Add a cover photograph", page: "Add a page", programme: "Add to the programme", duplicate: "Check the title and dates" };
function fixHref(key: string, edRoot: string): string | null {
  switch (key) {
    case "summary": case "cover": case "dates": case "duplicate": return `${edRoot}/details`;
    case "page": return `${edRoot}/pages`;
    case "programme": return `${edRoot}/programme`;
    default: return null;
  }
}

/** The checklist, exactly as OneShetland checks it when you submit: required items block the submission, recommended ones never do. */
export function ChecklistPanel({ checklist, edRoot }: { checklist: Readiness; edRoot?: string }) {
  if (checklist.length === 0) return <p className="text-sm text-ink-muted">The checklist could not be loaded. Refresh the page to try again.</p>;
  const ordered = [...checklist].sort((a, b) => Number(b.required) - Number(a.required));
  return (
    <ul className="divide-y divide-line">
      {ordered.map((c) => {
        const href = !c.ok && edRoot ? fixHref(c.key, edRoot) : null;
        return (
          <li key={c.key} className="flex items-start gap-3 py-2.5">
            <span aria-hidden className={"mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-bold " + (c.ok ? "bg-emerald-100 text-emerald-800" : c.required ? "bg-amber-100 text-amber-800" : "bg-sand text-ink-muted")}>{c.ok ? "✓" : "•"}</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">
                {c.label} <span className="sr-only">{c.ok ? "done" : "not done"}</span>
                {!c.ok && <span className="ml-2 text-xs font-normal text-ink-muted">{c.required ? "Needed before you submit" : "Recommended"}</span>}
              </p>
              {!c.ok && c.hint && <p className="text-xs text-ink-muted">{c.hint}</p>}
              {href && <Link href={href} className="mt-1 inline-flex min-h-[44px] items-center text-xs font-semibold text-ink underline underline-offset-2 sm:min-h-0">{FIX_LABEL[c.key] ?? "Open"}</Link>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Publish. Available only when OneShetland has approved the Edition AND it has an active package (the database enforces both); owners and administrators only.
 * When it is not available the reasons are given in words rather than leaving a dead button.
 */
export function PublishButton({ organiserSlug, edition, canAct, entitled }: { organiserSlug: string; edition: Edition; canAct: boolean; entitled: boolean }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { pending, msg, run } = useAction();
  const blockers = publishBlockers({ status: edition.status, review_state: edition.review_state, entitled });
  const ok = canAct && canPublishNow({ status: edition.status, review_state: edition.review_state, entitled });
  async function publish() {
    if (!(await confirm({ title: "Publish this Edition?", body: "It will appear on OneShetland straight away and anyone can see it.", confirmLabel: "Publish" }))) return;
    run(() => setEditionStatus(organiserSlug, edition.slug, "published"), { success: "Your Edition is live.", onOk: () => router.refresh() });
  }
  return (
    <div className="space-y-2">
      <button type="button" onClick={publish} disabled={pending || !ok} className={btnPrimary}>{pending ? "Publishing…" : "Publish"}</button>
      {!canAct && <p className="text-sm text-ink-soft">Only an owner or administrator can publish.</p>}
      {canAct && blockers.length > 0 && <ul className="list-disc pl-5 text-sm text-ink-soft">{blockers.map((b) => <li key={b}>{b}</li>)}</ul>}
      <Notice msg={msg} />
    </div>
  );
}

/** Unpublish / archive / restore / delete a draft. Administrators and owners only; the database refuses everyone else regardless. Publishing itself lives in the journey panel. */
export function StatusControls({ organiserSlug, edition, role }: { organiserSlug: string; edition: Edition; role: OrgRole }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { pending, msg, run } = useAction();
  if (!can(role, "admin")) return <p className="text-sm text-ink-muted">Only owners and administrators can unpublish or archive an Edition.</p>;
  const go = (to: "draft" | "archived", success: string) => run(() => setEditionStatus(organiserSlug, edition.slug, to), { success, onOk: () => router.refresh() });

  async function unpublish() {
    if (await confirm({ title: "Unpublish this Edition?", body: "It will disappear from OneShetland and go back to a draft. You can publish it again later without a new review.", confirmLabel: "Unpublish", danger: true })) go("draft", "Unpublished. It is a draft again.");
  }
  async function archive() {
    if (await confirm({ title: "Archive this Edition?", body: "It is taken off OneShetland and kept for your records.", confirmLabel: "Archive", danger: true })) go("archived", "Archived.");
  }
  async function del() {
    if (!(await confirm({ title: "Delete this draft?", body: "The draft, its pages, programme, updates and sponsors are deleted for good. This cannot be undone.", confirmLabel: "Delete permanently", danger: true }))) return;
    run(() => deleteEdition(organiserSlug, edition.slug), { onOk: () => router.push(`/organise/${organiserSlug}`) });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2.5">
        {edition.status === "archived" && <button type="button" onClick={() => go("draft", "Restored as a draft.")} disabled={pending} className={btnSecondary}>Restore as draft</button>}
        {edition.status === "published" && <button type="button" onClick={unpublish} disabled={pending} className={btnSecondary}>Unpublish</button>}
        {edition.status !== "archived" && edition.status !== "suspended" && <button type="button" onClick={archive} disabled={pending} className={btnSecondary}>Archive</button>}
        {edition.status === "draft" && <button type="button" onClick={del} disabled={pending} className={btnDanger}>Delete draft</button>}
      </div>
      {edition.status === "suspended" && <p className="text-sm font-medium text-rose-700">OneShetland has suspended this Edition{edition.suspended_reason ? `: ${edition.suspended_reason}` : ""}. Get in touch with OneShetland to resolve it.</p>}
      <Notice msg={msg} />
    </div>
  );
}
