"use client";

import { useRouter } from "next/navigation";
import { btnPrimary, Notice } from "./kit";
import { useAction } from "./use-action";

/** "Start Editions" for one Business or Hub on the Editions home. Goes straight to the new Editions tools. */
export function StartEditionsButton({ parentId, parentName, start }: { parentId: string; parentName: string; start: (parentId: string) => Promise<{ ok: true; slug: string } | { ok: false; error: string }> }) {
  const router = useRouter();
  const go = useAction();
  return (
    <div>
      <button type="button" className={btnPrimary} disabled={go.pending} aria-label={`Start Editions for ${parentName}`} onClick={() => go.run(() => start(parentId), { onOk: (r) => { router.push(`/organise/${r.slug}`); router.refresh(); } })}>
        {go.pending ? "Setting up…" : "Start Editions"}
      </button>
      <div className="mt-2"><Notice msg={go.msg} /></div>
    </div>
  );
}
