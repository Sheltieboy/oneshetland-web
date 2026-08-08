"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AUDIENCE_COOKIE, type Audience } from "@/lib/audience";

/**
 * The living-here / visiting switch. One tap, always visible, never a trap: it
 * reorders the page and nothing more, so there is no state to get stuck in.
 *
 * It used to be one pill reading "🏠 Living here · Change", which told you the
 * state but not the offer — you could see what you had and no reason to want
 * anything else, so there was nothing in it to click. Both options are now on
 * screen with the live one filled in, which is the whole explanation: you can
 * see the other choice exists and what it's called. The line above says what
 * pressing it does, and the reassurance that nothing disappears is the part
 * that makes it safe to try.
 *
 * Writes a cookie (so the server can reorder on the next render, signed in or
 * not) and, when signed in, the profile too — that's what carries the choice
 * over to the app.
 */

const OPTIONS: { key: Audience; emoji: string; label: string }[] = [
  { key: "resident", emoji: "🏠", label: "I live here" },
  { key: "visiting", emoji: "🧳", label: "I'm visiting" },
];

export function AudienceChip({ audience }: { audience: Audience }) {
  const router = useRouter();
  const [current, setCurrent] = useState<Audience>(audience);
  const [pending, startTransition] = useTransition();

  function choose(next: Audience) {
    if (next === current || pending) return;
    setCurrent(next); // optimistic — it's a display preference

    // A year is plenty, and this is not personal data worth a shorter life.
    document.cookie = `${AUDIENCE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;

    // Best-effort profile sync so the app agrees. Signed-out visitors just
    // keep the cookie.
    void (async () => {
      try {
        const sb = createClient();
        const { data } = await sb.auth.getUser();
        if (data.user) await sb.from("profiles").update({ audience: next }).eq("id", data.user.id);
      } catch { /* the cookie already did the useful part */ }
    })();

    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <p className="text-sm text-ink-muted">
        <span className="font-semibold text-ink">Show me Shetland as…</span>{" "}
        <span className="text-ink-faint">nothing gets hidden, it just reorders the page.</span>
      </p>

      <div
        role="group"
        aria-label="Show me Shetland as"
        className="inline-flex rounded-pill border border-line bg-paper p-0.5 shadow-soft"
      >
        {OPTIONS.map((o) => {
          const on = o.key === current;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => choose(o.key)}
              disabled={pending}
              aria-pressed={on}
              className={
                "inline-flex items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-xs font-bold transition disabled:opacity-60 " +
                (on ? "bg-navy text-paper shadow-sm" : "text-ink-soft hover:bg-sand")
              }
            >
              <span aria-hidden>{o.emoji}</span>
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
