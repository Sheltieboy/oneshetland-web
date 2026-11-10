"use client";

import { useRouter } from "next/navigation";
import { acceptInvite } from "@/app/organise/actions";
import { Notice, btnPrimary } from "./kit";
import { useAction } from "./use-action";

export function AcceptInviteButton({ inviteId }: { inviteId: string }) {
  const router = useRouter();
  const { pending, msg, run } = useAction();
  return (
    <div className="space-y-2">
      <button type="button" disabled={pending} className={btnPrimary}
        onClick={() => run(() => acceptInvite(inviteId), { onOk: (r) => { if (r.slug) router.push(`/organise/${r.slug}`); else router.refresh(); } })}>
        {pending ? "Joining…" : "Accept invitation"}
      </button>
      <Notice msg={msg} />
    </div>
  );
}
