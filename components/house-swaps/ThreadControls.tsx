"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { closeThread } from "@/app/house-swaps/actions";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { ReportForm } from "./ReportForm";
import { btnDanger, btnSecondary } from "./Shell";

/** Close the conversation, block the other member, or report it. Closing and blocking ask first. */
export function ThreadControls({ thread, open }: { thread: string; open: boolean }) {
  const confirm = useConfirm();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = (block: boolean) => start(async () => {
    const fd = new FormData();
    fd.set("thread", thread); fd.set("block", block ? "1" : "0");
    const r = await closeThread({ status: "idle" }, fd);   // a block redirects to the inbox from the server
    setMsg({ ok: r.status === "ok", text: r.message ?? "" });
    if (r.status === "ok") router.refresh();
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start gap-2">
        {open && <button type="button" disabled={pending} className={btnSecondary} onClick={async () => {
          if (await confirm({ title: "Close this conversation?", body: "Neither of you will be able to send more messages here.", confirmLabel: "Close conversation", cancelLabel: "Keep it open" })) run(false);
        }}>Close conversation</button>}
        <button type="button" disabled={pending} className={btnDanger} onClick={async () => {
          if (await confirm({ title: "Block this member?", body: "The conversation will close, and you will no longer see each other's adverts or messages. This can't be undone from here.", confirmLabel: "Block this member", cancelLabel: "Cancel", danger: true })) run(true);
        }}>Block this member</button>
        <ReportForm kind="thread" id={thread} label="Report this conversation" />
      </div>
      <div aria-live="polite" role="status">{msg && <p className={"rounded-lg px-3 py-2 text-sm font-semibold " + (msg.ok ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900")}>{msg.text}</p>}</div>
    </div>
  );
}
