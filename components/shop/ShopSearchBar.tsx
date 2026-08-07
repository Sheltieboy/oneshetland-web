"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Shop Shetland search field. Mirrors BoatsSearchBar: navigates on submit as a
 * client transition so there's a visible "Searching…" state, and carries the
 * active category/sort through so a search doesn't silently reset them.
 */
export function ShopSearchBar({
  q = "",
  category,
  sort,
  accent,
}: {
  q?: string;
  category?: string;
  sort?: string;
  accent: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(q);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams();
    const term = value.trim();
    if (term) p.set("q", term);
    if (category) p.set("category", category);
    if (sort) p.set("sort", sort);
    const s = p.toString();
    startTransition(() => router.push(s ? `/shop?${s}` : "/shop"));
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search everything on sale — e.g. gansey, silver, chutney…"
        className="w-full rounded-pill border border-line bg-paper px-5 py-2.5 text-ink shadow-soft outline-none placeholder:text-ink-faint"
      />
      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-2 rounded-pill px-5 py-2.5 font-semibold text-white transition disabled:opacity-70"
        style={{ background: accent }}
      >
        {pending && <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />}
        {pending ? "Searching…" : "Search"}
      </button>
    </form>
  );
}
