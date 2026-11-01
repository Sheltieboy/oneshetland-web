/**
 * plan-cta.ts — where a plan button on /business should go, for THIS visitor.
 *
 * The buttons used to send everybody to "Add your business", which for an existing owner meant creating a second, duplicate business just to
 * reach checkout. Now: nobody is asked to create anything to upgrade a business they already own.
 *
 * Pure, so every visitor type is tested. It decides a destination only; the billing page does the pricing, the confirmation and the charge.
 */
export type Tier = "free" | "pro" | "premium";
export type OwnedBusiness = { id: string; name: string; tier: Tier };

const RANK: Record<Tier, number> = { free: 0, pro: 1, premium: 2 };
export const FINDER_ANCHOR = "/business#find-your-business";

export type PlanCta =
  | { kind: "find"; href: string; label: string; note: string }                         // not an owner yet: find / claim / add first
  | { kind: "billing"; href: string; label: string; note: string; business: OwnedBusiness }   // owns exactly one business
  | { kind: "choose"; label: string; note: string; options: { business: OwnedBusiness; href: string; current: boolean }[] }  // owns several
  | { kind: "current"; href: string; label: string; note: string; business: OwnedBusiness };  // already on this plan or above

export const billingHref = (businessId: string, plan?: "pro" | "premium") => `/business/${businessId}/manage/billing${plan ? `?plan=${plan}` : ""}`;

export function planCta(plan: Tier, owned: OwnedBusiness[]): PlanCta {
  if (owned.length === 0) {
    return plan === "free"
      ? { kind: "find", href: FINDER_ANCHOR, label: "Find or add your business — free", note: "Claiming or adding a listing costs nothing." }
      : { kind: "find", href: FINDER_ANCHOR, label: "Find your business to get started", note: "Claim or add your listing first (free), then upgrade from your dashboard." };
  }
  if (plan === "free") {
    if (owned.length === 1) return { kind: "current", href: `/business/${owned[0].id}/manage`, label: "Open your dashboard", note: `You're on ${owned[0].tier === "free" ? "Free" : "a paid plan"} — upgrade any time.`, business: owned[0] };
    return { kind: "choose", label: "Open a dashboard", note: "Choose which business to manage.", options: owned.map((b) => ({ business: b, href: `/business/${b.id}/manage`, current: false })) };
  }
  const want = RANK[plan];
  if (owned.length === 1) {
    const b = owned[0];
    if (RANK[b.tier] >= want) return { kind: "current", href: billingHref(b.id), label: RANK[b.tier] === want ? "Your current plan — manage" : "Manage your plan", note: `${b.name} is already on ${b.tier === "premium" ? "Premium" : "Pro"}.`, business: b };
    return { kind: "billing", href: billingHref(b.id, plan), label: `Upgrade ${b.name} to ${plan === "pro" ? "Pro" : "Premium"}`, note: "You'll see the price and confirm before anything is charged.", business: b };
  }
  return {
    kind: "choose", label: `Choose which business to upgrade`, note: "You'll see the price and confirm before anything is charged.",
    options: owned.map((b) => ({ business: b, href: RANK[b.tier] >= want ? billingHref(b.id) : billingHref(b.id, plan), current: RANK[b.tier] >= want })),
  };
}
