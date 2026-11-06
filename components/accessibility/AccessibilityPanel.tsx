import Link from "next/link";
import { dateLine, groupFacts, hasContent, PROVENANCE_LABEL, STATUS_LONG, type FactStatus, type ProfileWithFacts, type SubjectType, TYPE_NOUN } from "@/lib/accessibility";
import { SuggestCorrection } from "./SuggestCorrection";
import { OwnerEditLink, OwnerInvite } from "./OwnerEdit";

/** Calm colours that do not rely on colour alone: the word is always there. */
const TONE: Record<FactStatus, string> = {
  available: "border-emerald-700 bg-emerald-50 text-emerald-950",
  partial: "border-amber-700 bg-amber-50 text-amber-950",
  not_available: "border-slate-500 bg-slate-100 text-slate-900",
  not_known: "border-line-strong bg-paper text-ink-soft",
};

/**
 * What a listing has told us about access. Shown on business, Hub, event and activity pages.
 * Silent when there is nothing to say (no empty box, no "not accessible"); instead a gentle invitation for the owner is shown to people who can edit.
 */
export function AccessibilityPanel({ type, id, profile, heading = "Access and assistance" }: { type: SubjectType; id: string; profile: ProfileWithFacts | null; heading?: string }) {
  if (!hasContent(profile)) return <OwnerInvite type={type} id={id} />;
  const p = profile!;
  const groups = groupFacts(p.facts);
  const level = PROVENANCE_LABEL[p.verification];
  return (
    <section aria-labelledby={`acc-${id}`} className="rounded-card border border-line bg-paper p-5 shadow-soft">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`acc-${id}`} className="font-display text-xl font-bold">{heading}</h2>
        <Link href="/accessible" className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-2">Accessible Shetland</Link>
      </div>
      {p.summary?.trim() && <p className="mt-2 whitespace-pre-line text-ink">{p.summary}</p>}
      {groups.length > 0 && (
        <div className="mt-4 space-y-4">
          {groups.map(({ group, items }) => (
            <div key={group.id}>
              <h3 className="text-sm font-bold uppercase tracking-wide text-ink-soft">{group.title}</h3>
              <ul className="mt-2 space-y-2">
                {items.map((f) => (
                  <li key={f.facility} className="flex flex-wrap items-start gap-x-3 gap-y-1">
                    <span className={`inline-flex min-w-[7.5rem] justify-center rounded-md border px-2 py-0.5 text-xs font-bold ${TONE[f.status]}`}>{STATUS_LONG[f.status]}</span>
                    <span className="min-w-0 flex-1 text-sm"><strong className="font-semibold">{f.label}</strong>{f.detail ? <span className="text-ink-soft"> — {f.detail}</span> : null}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {p.visit_tips?.trim() && (<div className="mt-4"><h3 className="text-sm font-bold uppercase tracking-wide text-ink-soft">Tips for your visit</h3><p className="mt-1 whitespace-pre-line text-sm">{p.visit_tips}</p></div>)}
      {p.access_contact?.trim() && (<div className="mt-4"><h3 className="text-sm font-bold uppercase tracking-wide text-ink-soft">Ask about access</h3><p className="mt-1 whitespace-pre-line text-sm">{p.access_contact}</p></div>)}
      <p className="mt-4 border-t border-line pt-3 text-xs text-ink-soft">
        <strong className="font-semibold text-ink">{level}.</strong>{" "}
        {p.verification === "owner_provided" ? "We have not checked it." : p.verification_note ? `${p.verification_note}${p.verified_on ? ` (${dateLine(p.verified_on)})` : ""}.` : ""}{" "}
        Last updated {dateLine(p.updated_at)}.{p.last_confirmed_at ? ` Confirmed as still right on ${dateLine(p.last_confirmed_at)}.` : ""}{" "}
        Anything not listed here has not been provided, so please ask before you travel. Details can change.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <SuggestCorrection type={type} id={id} noun={TYPE_NOUN[type]} />
        <OwnerEditLink type={type} id={id} />
      </div>
    </section>
  );
}
