"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/**
 * Find-your-business search, inside the join wizard.
 *
 * WHY IT'S HERE RATHER THAN A LINK TO /directory.
 * The wizard used to send people to the directory to find their listing, which
 * dropped them out of the flow entirely — and if their business wasn't there,
 * or they just wanted a look first, they'd lost the wizard with no obvious way
 * back. Searching in place keeps the flow intact.
 *
 * Leaving IS still correct once they pick one: the claim form asks for evidence
 * and is a considered step, and it's the last thing in the wizard anyway. The
 * fix is not making them leave before they've found anything.
 */

type Hit = {
  id: string;
  name: string;
  slug: string | null;
  address: string | null;
  is_claimed: boolean;
};

export function BusinessClaimSearch() {
  const [q, setQ] = useState("");
  // Results are keyed to the term they were for. That makes "searching" and
  // "too short to search" derived rather than stored, so the effect never has
  // to write state on the paths where there's nothing to look up — and a stale
  // result for a previous term can't be shown.
  const [result, setResult] = useState<{ term: string; hits: Hit[] } | null>(null);

  const term = q.trim();
  const active = term.length >= 2;
  const hits = result?.term === term ? result.hits : null;
  const searching = active && hits === null;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const { data } = await createClient()
          .from("local_businesses")
          .select("id, name, slug, address, is_claimed")
          .ilike("name", `%${term}%`)
          .eq("is_active", true)
          .order("name")
          .limit(6);
        if (!cancelled) setResult({ term, hits: (data ?? []) as Hit[] });
      } catch {
        if (!cancelled) setResult({ term, hits: [] });
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [active, term]);

  return (
    <div>
      <label htmlFor="w-biz" className="block text-sm font-semibold text-ink">
        Search the directory
      </label>
      <input
        id="w-biz"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Your business name…"
        autoComplete="off"
        className="auth-input mt-1.5"
      />

      {active && (
        <div className="mt-3">
          {searching ? (
            <p className="text-sm text-ink-muted">Looking…</p>
          ) : hits && hits.length > 0 ? (
            <ul className="space-y-2">
              {hits.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink">{b.name}</span>
                    {b.address && (
                      <span className="block truncate text-sm text-ink-muted">{b.address}</span>
                    )}
                  </span>
                  {b.is_claimed ? (
                    <span className="shrink-0 rounded-pill bg-sand px-3 py-1 text-sm font-semibold text-ink-muted">
                      Claimed
                    </span>
                  ) : (
                    <Link
                      href={`/directory/${b.slug ?? b.id}/claim`}
                      className="shrink-0 rounded-pill bg-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-navy-dark"
                    >
                      This is mine
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-line bg-sand px-4 py-3 text-sm text-ink-soft">
              Nothing matching &ldquo;{term}&rdquo;.{" "}
              <Link
                href="/directory/new"
                className="font-semibold text-navy underline underline-offset-2"
              >
                Add your business
              </Link>{" "}
              — it only takes a minute.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
