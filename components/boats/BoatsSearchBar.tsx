"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Da Boats search field. Navigates on submit like the old server form, but as a
 * client transition so we can show a "Searching…" spinner while the results
 * load — testers noted the plain form gave no sign anything was happening.
 * Carries the active decade/photos/builder filters through the search too.
 */
export function BoatsSearchBar({
  q = "",
  decade,
  photos,
  builder,
  accent,
}: {
  q?: string;
  decade?: string;
  photos?: string;
  builder?: string;
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
    if (decade) p.set("decade", decade);
    if (photos) p.set("photos", photos);
    if (builder) p.set("builder", builder);
    const s = p.toString();
    startTransition(() => router.push(s ? `/boats?${s}` : "/boats"));
  }

  return (
    <form onSubmit={submit} className="mb-3 flex gap-2">
      <input
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search by name or number — e.g. Brilliant, LK123…"
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
