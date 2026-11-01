"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { normaliseTier } from "@/lib/listing-tiers";
import type { OwnedBusiness } from "@/lib/plan-cta";

/**
 * Who is looking at /business: nobody signed in, or a member who owns (or has asked to claim) listings.
 *
 * Read in the browser, under the visitor's own session (RLS lets a member see only their own rows), so the page itself stays static and cacheable
 * and everybody gets the same fast first paint; owners then see their own business and dashboard links appear. It only ever decides what to SHOW.
 * Failing to read it (offline, a hiccup) leaves the page exactly as a signed-out visitor sees it, which is always a safe default.
 */
export type OwnerState = { status: "loading" | "signedOut" | "ready"; owned: OwnedBusiness[]; pending: { id: string; name: string }[] };
const Ctx = createContext<OwnerState>({ status: "loading", owned: [], pending: [] });
export const useOwner = () => useContext(Ctx);

export function OwnerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OwnerState>({ status: "loading", owned: [], pending: [] });
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const sb = createClient();
        const { data: { user } } = await sb.auth.getUser();
        if (!user) { if (live) setState({ status: "signedOut", owned: [], pending: [] }); return; }
        const [{ data: mine }, { data: claims }] = await Promise.all([
          sb.from("local_businesses").select("id, name, subscription_tier").eq("owner_id", user.id).order("name"),
          sb.from("business_claims").select("business_id, status, business:local_businesses(name)").eq("user_id", user.id).eq("status", "pending"),
        ]);
        if (!live) return;
        setState({
          status: "ready",
          owned: ((mine ?? []) as { id: string; name: string; subscription_tier: string | null }[]).map((b) => ({ id: b.id, name: b.name, tier: normaliseTier(b.subscription_tier) })),
          pending: ((claims ?? []) as unknown as { business_id: string; business: { name?: string } | { name?: string }[] | null }[])
            .map((c) => ({ id: c.business_id, name: (Array.isArray(c.business) ? c.business[0]?.name : c.business?.name) ?? "your business" })),
        });
      } catch { if (live) setState({ status: "signedOut", owned: [], pending: [] }); }
    })();
    return () => { live = false; };
  }, []);
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

/** The strip at the top of the hero for somebody who already has a listing (or a claim waiting). Renders nothing for everyone else. */
export function OwnerStrip() {
  const { status, owned, pending } = useOwner();
  if (status !== "ready" || (owned.length === 0 && pending.length === 0)) return null;
  return (
    <div className="mb-5 rounded-2xl border border-paper/25 bg-paper/10 p-4 text-paper backdrop-blur-sm" data-testid="owner-strip">
      {owned.length > 0 && (
        <>
          <p className="text-sm font-bold uppercase tracking-wide text-paper/80">Welcome back</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {owned.map((b) => (
              <li key={b.id}>
                <a href={`/business/${b.id}/manage`} className="inline-flex rounded-pill bg-paper px-4 py-2 text-sm font-bold text-navy hover:bg-sand">{b.name} — open dashboard</a>
              </li>
            ))}
          </ul>
        </>
      )}
      {pending.length > 0 && <p className="mt-2 text-sm text-paper/85">{pending.map((p) => p.name).join(", ")}: your claim is being checked — we&apos;ll email you the outcome.</p>}
    </div>
  );
}
