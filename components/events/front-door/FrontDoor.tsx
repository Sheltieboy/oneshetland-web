"use client";

import { useEffect, useReducer, useRef } from "react";
import Link from "next/link";
import { SHARED_CATEGORIES, ASK_QUESTION, ASK_ANSWERS } from "@/lib/event-categories";
import { NOT_AVAILABLE_YET, NOT_OPEN_YET } from "@/lib/contributor-copy";
import {
  ADD_BUSINESS_HREF, START_HUB_HREF, currentStep, initialState, reduce, shouldSuggestHub, signInHref, stepKey,
  type Organiser, type OwnershipState, type OwnershipStep,
} from "@/lib/event-ownership";
import * as C from "@/lib/event-ownership-copy";
import { SubmissionForm } from "@/components/events/front-door/SubmissionForm";

const ring = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";
const btn = `w-full rounded-2xl border border-line-strong bg-paper px-5 py-4 text-left text-lg font-semibold text-ink transition hover:bg-cream ${ring}`;
const textLink = `inline-flex min-h-11 items-center text-base font-semibold underline ${ring}`;
const primaryLink = `inline-flex min-h-12 items-center rounded-pill bg-navy px-6 py-3 text-lg font-bold text-white ${ring}`;
const panel = "mt-6 rounded-2xl border border-line-strong bg-cream p-6";
const eyebrow = "text-sm font-semibold uppercase tracking-wide text-ink/75";

/** What the server found out about sending an event: who the person is, whether the database can take it, whether the master switch is on. */
export type SubmitGate =
  | { kind: "signin" }
  | { kind: "ready"; staff: boolean; closedToPublic: boolean }
  | { kind: "closed" }
  | { kind: "unavailable" }
  | { kind: "error"; message: string };

export function FrontDoor({ gate, userId, initialCategory, organisers = [], organisersFailed = false, managesHub = null, priorStatuses = [] }: {
  gate: SubmitGate; userId: string | null; initialCategory?: string | null;
  organisers?: Organiser[]; organisersFailed?: boolean; managesHub?: boolean | null; priorStatuses?: string[];
}) {
  const [state, dispatch] = useReducer((s: OwnershipState, a: Parameters<typeof reduce>[1]) => reduce(s, a, organisers), initialCategory ?? null, initialState);
  const step = currentStep(state, organisers);
  const key = stepKey(step);
  const label = (slug: string) => SHARED_CATEGORIES.find((c) => c.slug === slug)?.label ?? "";

  // Move keyboard and screen-reader focus to the new step's heading whenever the step changes
  // (the button that was pressed disappears, which would otherwise drop focus to the page body).
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    stepHeading.current?.focus();
  }, [key]);

  const H = (id: string, children: React.ReactNode) => (
    <h2 id={id} ref={stepHeading} tabIndex={-1} className="mt-1 text-xl font-semibold text-ink outline-none">{children}</h2>
  );
  const back = <button type="button" onClick={() => dispatch({ type: "back" })} className={`mt-4 ${textLink}`}>{C.BACK}</button>;
  const changeOrg = <button type="button" onClick={() => dispatch({ type: "changeOrganiser" })} className={textLink}>{C.CHANGE_ORGANISER}</button>;
  const changeKind = <button type="button" onClick={() => dispatch({ type: "changeCategory" })} className={textLink}>{C.PICK_ANOTHER_KIND}</button>;
  const who = (o: Organiser | "independent") => (o === "independent" ? "Independent event" : o.name);

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="font-display text-4xl font-bold text-ink">Add an Event or Activity</h1>

      {/* Signed out: the organiser list needs the member's account, so sign in comes first and the way back is kept. */}
      {gate.kind === "signin" || !userId ? (
        <section aria-labelledby="fd-signin" className={panel}>
          <h2 id="fd-signin" className="text-xl font-semibold text-ink">{C.SIGN_IN_FIRST_TITLE}</h2>
          <p className="mt-3 text-lg text-ink/80">{C.SIGN_IN_FIRST_BODY}</p>
          <p className="mt-4"><Link href={signInHref(initialCategory)} className={primaryLink}>Sign in</Link></p>
        </section>
      ) : (
        renderStep(step)
      )}
    </div>
  );

  function renderStep(s: OwnershipStep) {
    if (s.step === "organiser") return organiserStep();
    if (s.step === "category") {
      return (
        <section aria-labelledby="fd-step2" className="mt-6">
          <p className={eyebrow}>{who(s.organiser)}</p>
          {H("fd-step2", "What kind of thing are you adding?")}
          <p className="mt-1 text-ink/70">{C.CATEGORY_STEP_HELP}</p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {SHARED_CATEGORIES.map((c) => (
              <li key={c.slug}><button type="button" className={btn} onClick={() => dispatch({ type: "category", slug: c.slug })}>{c.label}</button></li>
            ))}
          </ul>
          <div className="mt-3">{changeOrg}</div>
        </section>
      );
    }
    if (s.step === "ask") {
      return (
        <section aria-labelledby="fd-step3" className="mt-6">
          <p className={eyebrow}>{who(s.organiser)} · {label(s.slug)}</p>
          {H("fd-step3", ASK_QUESTION)}
          <ul className="mt-5 grid gap-3">
            {ASK_ANSWERS.map((a) => (
              <li key={a.value}><button type="button" className={btn} onClick={() => dispatch({ type: "answer", value: a.value })}>{a.label}</button></li>
            ))}
          </ul>
          {back}
        </section>
      );
    }
    return outcomeStep(s);
  }

  function organiserStep() {
    const businesses = organisers.filter((o) => o.kind === "business");
    const hubs = organisers.filter((o) => o.kind === "hub");
    const card = (o: Organiser, hint: string) => (
      <li key={`${o.kind}-${o.id}`}>
        <button type="button" className={`${btn} flex items-center gap-4`} onClick={() => dispatch({ type: "organiser", choice: { kind: o.kind, id: o.id } })}>
          {o.logoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={o.logoUrl} alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-xl border border-line object-cover" referrerPolicy="no-referrer" />
            : <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-navy/10 text-xl font-bold text-navy">{o.name.slice(0, 1).toUpperCase()}</span>}
          <span><span className="block">{o.name}</span><span className="block text-base font-normal text-ink-soft">{hint}</span></span>
        </button>
      </li>
    );
    return (
      <section aria-labelledby="fd-step1" className="mt-6">
        {H("fd-step1", C.ORGANISER_STEP_TITLE)}
        <p className="mt-1 text-ink/70">{C.ORGANISER_STEP_HELP}</p>
        {organisersFailed && <p role="status" className="mt-4 rounded-2xl border border-line-strong bg-cream p-4 text-base text-ink">{C.ORGANISERS_UNAVAILABLE_LINE}</p>}
        {organisers.length === 0 && !organisersFailed && <p className="mt-4 rounded-2xl border border-line-strong bg-cream p-4 text-base text-ink">{C.NO_ORGANISERS_LINE}</p>}
        {businesses.length > 0 && (<>
          <h3 className="mt-6 text-lg font-bold text-ink">My business</h3>
          <ul className="mt-2 grid gap-3">{businesses.map((o) => card(o, C.OPT_BUSINESS_HINT))}</ul>
        </>)}
        {hubs.length > 0 && (<>
          <h3 className="mt-6 text-lg font-bold text-ink">My hub or community organisation</h3>
          <ul className="mt-2 grid gap-3">{hubs.map((o) => card(o, C.OPT_HUB_HINT))}</ul>
        </>)}
        <h3 className="mt-6 text-lg font-bold text-ink">Something else</h3>
        <ul className="mt-2 grid gap-3">
          <li><button type="button" className={btn} onClick={() => dispatch({ type: "organiser", choice: { kind: "independent" } })}>
            <span className="block">{C.OPT_INDEPENDENT_TITLE}</span><span className="block text-base font-normal text-ink-soft">{C.OPT_INDEPENDENT_HINT}</span>
          </button></li>
        </ul>
      </section>
    );
  }

  function outcomeStep(s: Extract<OwnershipStep, { step: "outcome" }>) {
    const lab = label(s.slug);
    if (s.outcome === "organiser_event" || s.outcome === "organiser_activity") {
      const o = s.organiser as Organiser;
      const ev = s.outcome === "organiser_event";
      return (
        <section aria-labelledby="fd-out" aria-live="polite" className={panel}>
          <p className={eyebrow}>{o.name} · {lab}</p>
          {H("fd-out", ev ? "Add it from your events page" : "Add it from your regular activities page")}
          <p className="mt-3 text-ink/80">{ev ? C.ORGANISER_EVENT_NOTE : C.ORGANISER_ACTIVITY_NOTE}</p>
          <p className="mt-4"><Link href={s.href!} className={primaryLink}>{ev ? C.continueEventsLabel(o.name) : C.continueActivitiesLabel(o.name)}</Link></p>
          <div className="mt-3 flex flex-wrap gap-x-6">{changeOrg}{changeKind}</div>
        </section>
      );
    }
    if (s.outcome === "independent_event") {
      if (gate.kind === "ready" && userId) {
        return (
          <SubmissionForm slug={s.slug} categoryLabel={lab} userId={userId} staff={gate.staff && gate.closedToPublic}
            suggestHub={shouldSuggestHub({ statuses: priorStatuses, managesHub, justSubmitted: true })}
            onRestart={() => dispatch({ type: "restart" })} onChangeOrganiser={() => dispatch({ type: "changeOrganiser" })} />
        );
      }
      return (
        <section aria-live="polite" className={panel}>
          <p className={eyebrow}>{lab}</p>
          {H("fd-out", "This is an event")}
          <p className="mt-3 text-ink/80"><strong>{gate.kind === "closed" ? NOT_OPEN_YET : NOT_AVAILABLE_YET}</strong>{gate.kind === "error" ? ` (${gate.message})` : ""}</p>
          <div className="mt-3 flex flex-wrap gap-x-6">{changeOrg}<button type="button" onClick={() => dispatch({ type: "restart" })} className={textLink}>Start again</button></div>
        </section>
      );
    }
    // independent_activity: no form. Say plainly what is needed, and offer the two ways to get it, and the way back.
    return (
      <section aria-labelledby="fd-out" aria-live="polite" className={panel}>
        <p className={eyebrow}>{lab}</p>
        {H("fd-out", C.ACTIVITY_PANEL_TITLE)}
        <p className="mt-3 text-lg text-ink/80">{C.ACTIVITY_PANEL_WHY}</p>
        <p className="mt-3 text-lg text-ink/80">{C.ACTIVITY_PANEL_NEED}</p>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          <li><Link href={START_HUB_HREF} className={primaryLink}>{C.START_HUB_LABEL}</Link><p className="mt-1 text-base text-ink-soft">{C.START_HUB_HINT}</p></li>
          <li><Link href={ADD_BUSINESS_HREF} className={primaryLink}>{C.ADD_BUSINESS_LABEL}</Link><p className="mt-1 text-base text-ink-soft">{C.ADD_BUSINESS_HINT}</p></li>
        </ul>
        <div className="mt-6 border-t border-line pt-4">
          <button type="button" onClick={() => dispatch({ type: "oneOff" })} className={textLink}>{C.ONE_OFF_INSTEAD}</button>
          <p className="text-base text-ink-soft">{C.ONE_OFF_INSTEAD_HINT}</p>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-6">{changeOrg}{changeKind}</div>
      </section>
    );
  }
}
