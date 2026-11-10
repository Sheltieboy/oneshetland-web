"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleSaveEdition, togglePlanItem } from "@/app/editions/actions";

const cls = "inline-flex min-h-11 items-center text-sm font-semibold text-ink-soft underline underline-offset-[3px] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-60";

export function PlanRemoveButton({ editionId, kind, itemId, title }: { editionId: string; kind: "session" | "event" | "edition"; itemId: string; title: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span>
      <button type="button" disabled={pending} className={cls} onClick={() => start(async () => {
        setErr(null);
        const r = kind === "edition" ? await toggleSaveEdition(editionId, false) : await togglePlanItem(editionId, kind, itemId, false);
        if (!r.ok) setErr(r.error); else router.refresh();
      })}>{kind === "edition" ? "Stop following" : "Remove"}<span className="sr-only"> {title}</span></button>
      {err && <span role="alert" className="ml-2 text-sm text-rose-700">{err}</span>}
    </span>
  );
}
