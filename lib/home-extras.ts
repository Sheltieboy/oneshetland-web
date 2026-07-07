/**
 * home-extras.ts — server-side, auth-scoped concierge data for the home page.
 *
 *   • Wallet balance         (local_wallet_balances)
 *   • Followed businesses    (local_business_follows) — powers the "For You" row
 *   • Today's game prompt     (date-rotated, mirrors the app's GamesRow)
 *
 * Reads use the cookie-bound server client so they're scoped to the signed-in
 * user; signed-out callers get empty/zero values. Never throws — the home page
 * must render regardless.
 */

import { createClient } from "@/lib/supabase/server";

export type FollowedBiz = {
  id: string;
  name: string;
  category: string | null;
  logo_url: string | null;
  slug: string | null;
};

export type HomePersonal = {
  signedIn: boolean;
  walletPence: number;
  followed: FollowedBiz[];
};

/** Wallet balance + followed businesses for the signed-in user (one round-trip). */
export async function getHomePersonal(): Promise<HomePersonal> {
  try {
    const sb = await createClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return { signedIn: false, walletPence: 0, followed: [] };

    const [balanceRes, followRes] = await Promise.all([
      sb.from("local_wallet_balances").select("balance_pence").eq("user_id", user.id).maybeSingle(),
      sb.from("local_business_follows").select("business_id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(6),
    ]);

    const walletPence = (balanceRes.data as { balance_pence: number } | null)?.balance_pence ?? 0;

    const ids = ((followRes.data ?? []) as { business_id: string }[]).map((r) => r.business_id);
    let followed: FollowedBiz[] = [];
    if (ids.length > 0) {
      const { data: biz } = await sb
        .from("local_businesses")
        .select("id, name, category, logo_url, slug")
        .in("id", ids)
        .eq("is_active", true);
      const map = Object.fromEntries(((biz ?? []) as FollowedBiz[]).map((b) => [b.id, b]));
      followed = ids.map((id) => map[id]).filter((b): b is FollowedBiz => !!b);
    }

    return { signedIn: true, walletPence, followed };
  } catch {
    return { signedIn: false, walletPence: 0, followed: [] };
  }
}

/* ── Today's game prompt — date-rotated, mirrors the app's GamesRow ─────────── */

export type GamePrompt = { title: string; sub: string; href: string };

const GAME_ROTATION: GamePrompt[] = [
  { title: "Spik Sprint", sub: "60 seconds. How many do you ken?", href: "/games/spik-sprint" },
  { title: "Guess Da Wird", sub: "Today's Shetlandic word.", href: "/games/guess-da-wird" },
  { title: "Map It", sub: "Drop a pin near today's place.", href: "/games/map-it" },
  { title: "Spik Snap", sub: "Match the word to its meaning.", href: "/games/spik-snap" },
];

export function getTodaysGame(): GamePrompt {
  return GAME_ROTATION[new Date().getDate() % GAME_ROTATION.length];
}

export function formatPence(pence: number): string {
  if (pence % 100 === 0) return `£${Math.round(pence / 100)}`;
  return `£${(pence / 100).toFixed(2)}`;
}
