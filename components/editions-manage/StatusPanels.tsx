"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { deleteEdition, setEditionStatus } from "@/app/organise/actions";
import { canPublish, can, type Readiness } from "@/lib/editions/rules";
import type { Edition, EditionEntitlement, OrgRole } from "@/lib/editions/types";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { Notice, Pill, btnDanger, btnPrimary, btnSecondary } from "./kit";
import { useAction } from "./use-action";

const fmt = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" }).format(new Date(iso));

/** The publish checklist: required items block publishing (the database enforces them), recommended ones do not. */
/** Where to go to fix each unmet item, so an organiser never has to guess which tab. */
const FIX_LABEL: Record<string, string> = { verified: "Request verification", entitled: "See the package", summary: "Add a summary", cover: "Add a cover photograph", pages: "Add a page", programme: "Add to the programme" };
function fixHref(key: string, orgRoot: string, edRoot: string): string | null {
  switch (key) {
    case "verified": return orgRoot;
    case "entitled": return "#package";
    case "summary": case "cover": return `${edRoot}/details`;
    case "pages": return `${edRoot}/pages`;
    case "programme": return `${edRoot}/programme`;
    default: return null;
  }
}
export function ChecklistPanel({ checklist, orgRoot, edRoot }: { checklist: Readiness; orgRoot?: string; edRoot?: string }) {
  const required = new Set(["verified", "entitled", "summary"]);
  return (
    <ul className="divide-y divide-line">
      {checklist.map((c) => (
        <li key={c.key} className="flex items-start gap-3 py-2.5">
          <span aria-hidden className={"mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-bold " + (c.ok ? "bg-emerald-100 text-emerald-800" : required.has(c.key) ? "bg-amber-100 text-amber-800" : "bg-sand text-ink-muted")}>{c.ok ? "✓" : "•"}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">
              {c.label} <span className="sr-only">{c.ok ? "done" : "not done"}</span>
              {!c.ok && <span className="ml-2 text-xs font-normal text-ink-muted">{required.has(c.key) ? "Required to publish" : "Recommended"}</span>}
            </p>
            {!c.ok && <p className="text-xs text-ink-muted">{c.hint}</p>}
            {!c.ok && orgRoot && edRoot && fixHref(c.key, orgRoot, edRoot) && <a href={fixHref(c.key, orgRoot, edRoot)!} className="mt-1 inline-block text-xs font-semibold text-ink underline underline-offset-2">{FIX_LABEL[c.key]}</a>}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Publish / unpublish / archive / delete. Administrators and owners only; the database refuses everyone else regardless. */
export function StatusControls({ organiserSlug, edition, role, checklist }: { organiserSlug: string; edition: Edition; role: OrgRole; checklist: Readiness }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { pending, msg, run } = useAction();
  if (!can(role, "admin")) return <p className="text-sm text-ink-muted">Only administrators and owners can publish or archive an Edition.</p>;
  const ready = canPublish(checklist);
  const go = (to: "draft" | "published" | "archived", success: string) => run(() => setEditionStatus(organiserSlug, edition.slug, to), { success, onOk: () => router.refresh() });

  async function publish() {
    if (await confirm({ title: "Publish this Edition?", body: "It will appear on OneShetland straight away and anyone can see it.", confirmLabel: "Publish" })) go("published", "Published. Your Edition is now live.");
  }
  async function unpublish() {
    if (await confirm({ title: "Unpublish this Edition?", body: "It will disappear from OneShetland and go back to a draft. You can publish it again later.", confirmLabel: "Unpublish", danger: true })) go("draft", "Unpublished. It is a draft again.");
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
        {edition.status === "draft" && <button type="button" onClick={publish} disabled={pending || !ready} className={btnPrimary}>Publish</button>}
        {edition.status === "archived" && <button type="button" onClick={() => go("draft", "Restored as a draft.")} disabled={pending} className={btnSecondary}>Restore as draft</button>}
        {edition.status === "published" && <button type="button" onClick={unpublish} disabled={pending} className={btnSecondary}>Unpublish</button>}
        {edition.status !== "archived" && edition.status !== "suspended" && <button type="button" onClick={archive} disabled={pending} className={btnSecondary}>Archive</button>}
        {edition.status === "draft" && <button type="button" onClick={del} disabled={pending} className={btnDanger}>Delete draft</button>}
      </div>
      {edition.status === "draft" && !ready && <p className="text-sm text-ink-soft">Finish the required items in the checklist to publish.</p>}
      {edition.status === "suspended" && <p className="text-sm font-medium text-rose-700">OneShetland has suspended this Edition{edition.suspended_reason ? `: ${edition.suspended_reason}` : ""}. Contact support to resolve it.</p>}
      <Notice msg={msg} />
    </div>
  );
}

/** Read-only entitlement state. Organisers cannot grant themselves anything; this explains what exists and what to do. */
export function EntitlementPanel({ entitlements, entitled }: { entitlements: EditionEntitlement[]; entitled: boolean }) {
  const now = Date.now();
  const live = entitlements.filter((e) => e.feature === "publish" && !e.voided_at && Date.parse(e.starts_at) <= now && Date.parse(e.ends_at) > now);
  const past = entitlements.filter((e) => !live.includes(e));
  return (
    <div className="space-y-3">
      {entitled ? (
        <p className="flex flex-wrap items-center gap-2 text-sm text-ink"><Pill label="Package active" tone="green" />
          {live[0] && <span>Publishing is covered until {fmt(live[0].ends_at)}.</span>}</p>
      ) : (
        <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">No active package for this Edition.</p>
          <p className="mt-0.5">An Edition needs an active package before it can be published. Packages are not yet available to buy online. To get one activated, <Link href="/support" className="font-semibold underline">ask OneShetland</Link> and we will set it up with you.</p>
        </div>
      )}
      {past.length > 0 && (
        <details className="text-sm text-ink-soft">
          <summary className="cursor-pointer font-semibold">History ({past.length})</summary>
          <ul className="mt-2 space-y-1">
            {past.map((e) => <li key={e.id}>{e.feature.replace(/_/g, " ")}: {fmt(e.starts_at)} to {fmt(e.ends_at)}{e.voided_at ? " (withdrawn)" : Date.parse(e.ends_at) <= now ? " (ended)" : " (not started)"}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}
