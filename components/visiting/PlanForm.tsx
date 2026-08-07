"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AiGlow } from "@/components/ai/AiGlow";
import { PEERIE } from "@/lib/peerie";
import { INTERESTS, type Interest, type Transport } from "@/lib/planner";

/**
 * The planner form.
 *
 * A client component purely so Peerie Bot's signature glow can run while it
 * thinks. As a plain GET form the browser just sat on a white page for several
 * seconds with nothing to say a thing was happening — and the ring-colour glow
 * is exactly the house signal for "Peerie Bot is working on this".
 *
 * It still carries method="get" and real field names, so with JavaScript off
 * it submits the old way and the page works. The URL it navigates to is the
 * same either way, which keeps the plan shareable.
 */
export function PlanForm({
  date, from, to, transport, chosen,
}: {
  date: string;
  from: string;
  to: string;
  transport: Transport;
  chosen: Interest[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [picked, setPicked] = useState<Interest[]>(chosen);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const p = new URLSearchParams();
    p.set("go", "1");
    p.set("date", String(form.get("date") ?? date));
    p.set("from", String(form.get("from") ?? from));
    p.set("to", String(form.get("to") ?? to));
    p.set("transport", String(form.get("transport") ?? transport));
    for (const v of form.getAll("interests")) p.append("interests", String(v));
    startTransition(() => router.push(`/visiting/plan?${p.toString()}`));
  }

  const field = "rounded-xl border border-line bg-paper px-4 py-2.5 text-ink shadow-soft outline-none";
  const lab = "mb-1 block text-sm font-semibold text-ink-soft";

  return (
    <AiGlow active={pending}>
      <form method="get" onSubmit={submit} className="rounded-card border border-line bg-paper p-5 shadow-soft">
        <input type="hidden" name="go" value="1" />
        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <label className={lab} htmlFor="date">Which day</label>
            <input id="date" name="date" type="date" defaultValue={date} className={field + " w-full"} />
          </div>
          <div>
            <label className={lab} htmlFor="from">From</label>
            <input id="from" name="from" type="time" defaultValue={from} className={field + " w-full"} />
          </div>
          <div>
            <label className={lab} htmlFor="to">Until</label>
            <input id="to" name="to" type="time" defaultValue={to} className={field + " w-full"} />
          </div>
          <div>
            <label className={lab} htmlFor="transport">Getting about</label>
            <select id="transport" name="transport" defaultValue={transport} className={field + " w-full"}>
              <option value="driving">By car</option>
              <option value="walking">On foot</option>
            </select>
          </div>
        </div>

        <fieldset className="mt-5">
          <legend className={lab}>What are you after?</legend>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((i) => {
              const on = picked.includes(i.key);
              return (
                <label
                  key={i.key}
                  className={
                    "cursor-pointer rounded-pill border px-3.5 py-1.5 text-sm font-semibold transition " +
                    (on ? "border-transparent bg-purple-600 text-white" : "border-line-strong text-ink-soft hover:bg-sand")
                  }
                >
                  <input
                    type="checkbox"
                    name="interests"
                    value={i.key}
                    checked={on}
                    onChange={(e) =>
                      setPicked((prev) => (e.target.checked ? [...prev, i.key] : prev.filter((k) => k !== i.key)))
                    }
                    className="sr-only"
                  />
                  <span aria-hidden>{i.emoji}</span> {i.label}
                </label>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-ink-faint">Pick none and we&apos;ll give you a bit of everything.</p>
        </fieldset>

        <button
          type="submit"
          disabled={pending}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-pill py-3 font-semibold text-white shadow-soft transition hover:brightness-95 disabled:opacity-80 sm:w-auto sm:px-8"
          style={{ background: "#7c3aed" }}
        >
          {pending && (
            <span
              aria-hidden
              className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white"
            />
          )}
          {pending ? `${PEERIE.name} is working…` : "Plan my day"}
        </button>
      </form>
    </AiGlow>
  );
}
