import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeader } from "@/components/admin/AdminUI";
import { EditionDecision } from "@/components/admin/EditionDecision";
import { ErrorNote, Facts, FlagPill, ParentPill, Section, day, when } from "@/components/admin/EditionsAdminParts";
import { pounds } from "@/lib/editions/commerce";
import { KIND_LABEL, type EditionKind } from "@/lib/editions/types";
import { isUuid } from "../../helpers";
import { reviewDetail, type ReviewDetail } from "../../queries";
import { ageText, changeLines, checkGroups, checkHint, historyLabel, previewPath, type Check } from "../review";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review an Edition · Admin" };

const STATE_WORDS: Record<string, string> = { not_submitted: "Draft: not submitted", submitted: "Waiting for review", changes_requested: "Changes requested", approved: "Approved", rejected: "Rejected" };
const ORDER_WORDS: Record<string, string> = { paid: "Paid", pending: "Payment started, not finished", refunded: "Refunded", failed: "Payment failed", cancelled: "Cancelled", requires_payment: "Payment started, not finished" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { detail, error } = await reviewDetail(id);
  if (error === "not_found") notFound();
  if (!detail) return <><BackLink /><ErrorNote>This Edition could not be loaded just now. Try again in a moment.</ErrorNote></>;
  const { edition: e, organiser: o, parent: p, history } = detail;
  const groups = checkGroups(detail.checks);
  const waiting = e.review_state === "submitted";
  const latest = history[0];
  const lastSubmission = history.find((h) => h.action === "material_change" || h.action === "submitted");
  const materialChange = waiting && lastSubmission?.action === "material_change" ? lastSubmission : undefined;
  const firstEdition = o.status === "pending";

  return (
    <>
      <BackLink />
      <AdminHeader title={e.title} sub={`${KIND_LABEL[e.kind as EditionKind] ?? e.kind} · ${e.starts_on === e.ends_on ? day(e.starts_on) : `${day(e.starts_on)} to ${day(e.ends_on)}`}`} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="rounded-pill bg-sand px-2.5 py-0.5 text-xs font-bold text-ink-soft">{STATE_WORDS[e.review_state] ?? e.review_state}</span>
        {firstEdition && <FlagPill>First Edition: identity not checked yet</FlagPill>}
        {materialChange && <FlagPill>Material change</FlagPill>}
        {o.reserved_name_flag && <FlagPill>Reserved name: check carefully</FlagPill>}
      </div>

      <a href={previewPath(e.slug)} target="_blank" rel="noopener" className="mb-6 flex min-h-12 items-center justify-center rounded-card border-2 border-navy bg-white px-5 py-3 text-center text-base font-bold text-navy hover:bg-navy hover:text-white">
        Preview as visitors will see it <span aria-hidden="true" className="ml-2">↗</span><span className="sr-only"> (opens in a new tab)</span>
      </a>

      {materialChange?.changes && (
        <Section title="What changed since it was approved">
          <ul className="space-y-2 text-sm">
            {changeLines(materialChange.changes).map((c) => (
              <li key={c.field} className="rounded-lg bg-amber-50 p-3"><span className="font-bold text-ink">{c.field}</span><br /><span className="text-ink-soft">Was: {c.from}</span><br /><span className="font-semibold text-ink">Now: {c.to}</span></li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="The Edition">
        <Facts rows={[
          ["Summary", e.summary], ["Kind", KIND_LABEL[e.kind as EditionKind] ?? e.kind], ["Dates", e.starts_on === e.ends_on ? day(e.starts_on) : `${day(e.starts_on)} to ${day(e.ends_on)}`],
          ["Content", `${e.pages} page${e.pages === 1 ? "" : "s"}, ${e.sessions} programme item${e.sessions === 1 ? "" : "s"}`], ["Cover picture", e.cover_url ? "Added" : "Not added"],
          ["Submitted", e.submitted_at ? when(e.submitted_at) : ""],
        ]} />
      </Section>

      <Section title="Who runs it">
        <p className="mb-3 flex flex-wrap items-center gap-2 text-base font-bold text-ink">{p?.name ?? o.name} <ParentPill kind={p?.kind} />{p?.verified && <span className="rounded-pill bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-900">Verified</span>}{p && !p.active && <FlagPill>Not active</FlagPill>}</p>
        {p ? <ParentFacts p={p} /> : <p className="text-sm text-rose-700">The Business or Hub behind this organiser could not be found.</p>}
        <div className="mt-3"><Facts rows={[["Editions organiser", `${o.name}, ${firstEdition ? "identity not checked yet" : o.status === "verified" ? "identity checked" : o.status}`]]} /></div>
        {firstEdition && <p className="mt-3 rounded-lg bg-sand p-3 text-sm text-ink-soft">This is their first Edition. Approving it also records that you checked who they are.</p>}
      </Section>

      <Section title="Checks">
        <CheckList title="Required" items={groups.required} />
        <CheckList title="Recommended" items={groups.recommended} />
        <CheckList title="For OneShetland staff only" items={groups.staff} />
      </Section>

      <Section title="Package">
        <Facts rows={[["Package", detail.package.entitled ? "Active: it can go live once the organiser publishes" : "None yet. The organiser chooses one after approval."],
          ...(detail.package.orders.length ? [["Orders", detail.package.orders.map((x) => `${x.package ?? "Package"}: ${ORDER_WORDS[x.status] ?? x.status}${x.amount_pence ? ` (${pounds(x.amount_pence)})` : ""}`).join("; ")] as [string, string]] : [])]} />
      </Section>

      <Section title="Your decision">
        {waiting
          ? <EditionDecision editionId={e.id} title={e.title} firstReserved={o.reserved_name_flag} firstEdition={firstEdition} />
          : <p className="text-sm text-ink-soft">This Edition is not waiting for review{latest ? `. Last event: ${historyLabel(latest.action).toLowerCase()}, ${when(latest.at)}` : ""}. <Link href="/admin/editions/approvals" className="font-bold text-navy hover:underline">Back to the queue</Link>.</p>}
      </Section>

      <Section title="History">
        {!history.length ? <p className="text-sm text-ink-muted">No review activity yet.</p> : (
          <ol className="space-y-3">
            {history.map((h, i) => (
              <li key={i} className="rounded-lg border border-line p-3 text-sm">
                <p className="font-bold text-ink">{historyLabel(h.action)} <span className="font-normal text-ink-muted">· {when(h.at)}{h.by ? ` · ${h.by}` : ""}</span></p>
                {h.note && <p className="mt-1 whitespace-pre-line text-ink-soft">{h.note}</p>}
                {h.changes && changeLines(h.changes).map((c) => <p key={c.field} className="mt-1 text-ink-soft">{c.field}: {c.from} → {c.to}</p>)}
              </li>
            ))}
          </ol>
        )}
      </Section>
    </>
  );
}

const BackLink = () => <p className="mb-2 text-sm"><Link href="/admin/editions/approvals" className="inline-flex min-h-11 items-center font-bold text-navy hover:underline">← Edition approvals</Link></p>;

function ParentFacts({ p }: { p: NonNullable<ReviewDetail["parent"]> }) {
  const age = ageText(p.created_at);
  if (p.kind === "hub") {
    return <Facts rows={[["Owner", p.owner], ["Committee", p.committee?.length ? p.committee.join(", ") : ""], ["Members", p.members != null ? String(p.members) : ""], ["Hub age", age], ["Verified badge", p.verified ? "Yes" : "No"]]} />;
  }
  return <Facts rows={[["Owner", p.owner], ["Claimed", p.claim_approved_at ? day(p.claim_approved_at) : "No approved claim on record"], ["Listing age", age], ["Verified badge", p.verified ? "Yes" : "No"]]} />;
}

function CheckList({ title, items }: { title: string; items: Check[] }) {
  if (!items.length) return null;
  return (
    <div className="mb-4 last:mb-0">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-muted">{title}</h3>
      <ul className="space-y-2">
        {items.map((c) => (
          <li key={c.key} className={"flex gap-3 rounded-lg border p-3 text-sm " + (c.ok ? "border-emerald-200 bg-emerald-50/60" : c.required ? "border-rose-300 bg-rose-50" : "border-amber-300 bg-amber-50")}>
            <span aria-hidden="true" className={"mt-0.5 font-extrabold " + (c.ok ? "text-emerald-700" : c.required ? "text-rose-700" : "text-amber-800")}>{c.ok ? "✓" : "!"}</span>
            <span className="min-w-0">
              <span className="font-semibold text-ink">{c.label}</span> <span className="sr-only">{c.ok ? "Passed" : c.required ? "Not done, required" : "Flagged"}</span>
              {checkHint(c) && <span className="block text-ink-soft">{checkHint(c)}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
