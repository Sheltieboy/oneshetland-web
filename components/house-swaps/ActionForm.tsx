"use client";

import { useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ActionState } from "@/app/house-swaps/actions";

const IDLE: ActionState = { status: "idle" };

/**
 * A form wired to a House Swaps server action. Shows the outcome in plain words (aria-live), keeps what the person typed when something goes wrong,
 * and clears the form and refreshes the page when it worked. The action may also redirect (the server action's own redirect is followed).
 */
export function ActionForm({ action, children, className, resetOnOk = true, refreshOnOk = true, id }: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: ReactNode; className?: string; resetOnOk?: boolean; refreshOnOk?: boolean; id?: string;
}) {
  const [state, setState] = useState<ActionState>(IDLE);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setState(IDLE);
    start(async () => {
      const r = await action(IDLE, fd);
      setState(r);
      if (r.status === "ok") {
        if (resetOnOk) form.reset();
        if (refreshOnOk) router.refresh();
      }
    });
  }

  return (
    <form ref={ref} id={id} onSubmit={onSubmit} className={className} aria-busy={pending}>
      <fieldset disabled={pending} className="contents">{children}</fieldset>
      <div aria-live="polite" role="status">
        {state.status === "ok" && state.message && <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">{state.message}</p>}
      </div>
      <div role="alert">
        {state.status === "error" && state.message && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-900">{state.message}</p>}
      </div>
    </form>
  );
}
