"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AUDIENCE_COOKIE, AUDIENCE_LABEL, type Audience } from "@/lib/audience";

/**
 * The living-here / visiting toggle. One tap, always visible, never a trap:
 * it reorders the page and nothing more, so there is no state to get stuck in.
 *
 * Writes a cookie (so the server can reorder on the next render, signed in or
 * not) and, when signed in, the profile too — that's what carries the choice
 * over to the app.
 */
export function AudienceChip({ audience }: { audience: Audience }) {
  const router = useRouter();
  const [current, setCurrent] = useState<Audience>(audience);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next: Audience = current === "visiting" ? "resident" : "visiting";
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
    <button
      onClick={toggle}
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-pill border border-line bg-paper px-3.5 py-1.5 text-xs font-bold text-ink-soft shadow-soft transition hover:bg-sand disabled:opacity-60"
      aria-label={
        current === "visiting"
          ? "Showing the visiting view. Switch to living here."
          : "Showing the living here view. Switch to visiting."
      }
    >
      <span aria-hidden>{current === "visiting" ? "🧳" : "🏠"}</span>
      {AUDIENCE_LABEL[current]}
      <span className="text-ink-faint">·</span>
      <span className="text-sky-600">Change</span>
    </button>
  );
}
