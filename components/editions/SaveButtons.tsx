"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toggleSaveEdition, togglePlanItem } from "@/app/editions/actions";
import { track } from "@/lib/analytics";

const base = "ed-btn ed-btn--small";

/** Save / unsave an Edition. Signed out: a plain link to sign in that returns here. Never a dead end. */
export function SaveEditionButton({ editionId, initial, signedIn, nextPath }: { editionId: string; initial: boolean; signedIn: boolean; nextPath: string }) {
  const [on, setOn] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!signedIn) return <Link href={`/sign-in?next=${encodeURIComponent(nextPath)}`} className={base}><span aria-hidden="true">☆</span> Save this Edition</Link>;
  return (
    <span className="inline-flex flex-col items-start">
      <button type="button" aria-pressed={on} disabled={pending} className={base}
        onClick={() => start(async () => { setErr(null); const r = await togglePlanSave(); if (!r.ok) setErr(r.error); else { setOn(r.on); if (r.on) track("edition_saved", { objectType: "edition", objectId: editionId }); } })}>
        <span aria-hidden="true">{on ? "★" : "☆"}</span> {on ? "Saved" : "Save this Edition"}
      </button>
      {err && <span role="alert" className="ed-small mt-1" style={{ color: "#8a1c1c" }}>{err}</span>}
    </span>
  );
  function togglePlanSave() { return toggleSaveEdition(editionId, !on); }
}

/** Add or remove one session or event from the visitor's plan. */
export function PlanToggle({ editionId, kind, itemId, title, initial, signedIn, nextPath }: { editionId: string; kind: "session" | "event"; itemId: string; title: string; initial: boolean; signedIn: boolean; nextPath: string }) {
  const [on, setOn] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!signedIn) return <Link href={`/sign-in?next=${encodeURIComponent(nextPath)}`} className="ed-plan">+ Add to my plan<span className="sr-only"> : {title} (sign in)</span></Link>;
  return (
    <span className="inline-flex flex-col items-start">
      <button type="button" aria-pressed={on} disabled={pending} className="ed-plan"
        onClick={() => start(async () => { setErr(null); const r = await togglePlanItem(editionId, kind, itemId, !on); if (!r.ok) setErr(r.error); else { setOn(r.on); if (r.on) track("edition_plan_added", { objectType: "edition", objectId: editionId, props: { kind } }); } })}>
        {on ? "\u2713 In my plan" : "+ Add to my plan"}<span className="sr-only"> : {title}</span>
      </button>
      {err && <span role="alert" className="ed-small mt-1" style={{ color: "#8a1c1c" }}>{err}</span>}
    </span>
  );
}
