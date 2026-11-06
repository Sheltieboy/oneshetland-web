"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { SubjectType } from "@/lib/accessibility";

/** Shown only to people who may edit this listing, decided by the same database rule that the save uses. Checked in the browser so the public page itself stays cacheable. */
export function useCanEdit(type: SubjectType, id: string) {
  const [state, setState] = useState<{ canEdit: boolean; signedIn: boolean }>({ canEdit: false, signedIn: false });
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const sb = createClient();
        const { data: { user } } = await sb.auth.getUser();
        if (!user) return;
        const { data } = await sb.rpc("accessibility_can_edit", { p_type: type, p_id: id });
        if (live) setState({ canEdit: data === true, signedIn: true });
      } catch { /* the page simply shows the public view */ }
    })();
    return () => { live = false; };
  }, [type, id]);
  return state;
}

export function OwnerInvite({ type, id }: { type: SubjectType; id: string }) {
  const { canEdit } = useCanEdit(type, id);
  if (!canEdit) return null;
  return (
    <section aria-labelledby={`inv-${id}`} className="rounded-card border border-line bg-paper p-5">
      <h2 id={`inv-${id}`} className="font-display text-lg font-bold">Help people plan their visit</h2>
      <p className="mt-1 text-sm text-ink-soft">Tell people about steps, parking, toilets, quiet times and how you can help. It is free, you choose what to say, and nothing is compulsory. Only you see this message.</p>
      <Link href={`/accessible/edit/${type}/${id}`} className="mt-3 inline-flex min-h-11 items-center rounded-pill bg-ink px-5 text-sm font-bold text-white">Add access information</Link>
    </section>
  );
}

export function OwnerEditLink({ type, id }: { type: SubjectType; id: string }) {
  const { canEdit } = useCanEdit(type, id);
  if (!canEdit) return null;
  return <Link href={`/accessible/edit/${type}/${id}`} className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-2">Edit this information</Link>;
}
