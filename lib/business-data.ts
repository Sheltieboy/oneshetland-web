import type { OpeningHours } from "@/lib/opening-hours";
/**
 * business-data.ts — shared types/constants/helpers for the web "Manage
 * Business" dashboard. Mirrors the app's lib/local-api.ts (the management side).
 * Client-safe: NO next/headers. Auth-scoped reads live in business-data.server.ts;
 * writes/edge-function calls live in lib/business-client.ts.
 */

export type SubscriptionTier = "free" | "pro" | "premium";

/** The full management view of a business (owner-readable row). */
export type { OpeningHours } from "@/lib/opening-hours";

export type ManagedBusiness = {
  id: string;
  owner_id: string;
  name: string;
  category: string | null;
  description: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  logo_url: string | null;
  cover_url: string | null;
  brand_color: string | null;
  tags: string[] | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  slug: string | null;
  opening_hours: OpeningHours | null;
  /** Last date opening_hours is known good (seasonal). NULL = no known end. */
  opening_hours_until: string | null;
  planner_visitor_ready: boolean | null;
  planner_dwell_minutes: number | null;
  planner_setting: "indoor" | "outdoor" | "both" | null;
  planner_good_for: string[] | null;
  planner_booking: "none" | "advised" | "required" | null;
  planner_note: string | null;
  is_verified: boolean;
  is_active: boolean;
  // Subscription
  subscription_tier: SubscriptionTier;
  subscription_until: string | null;
  subscription_cancel_at_period_end: boolean | null;
  // Wallet + central/business payout
  accepts_wallet: boolean;
  cashback_percent: number;
  payout_enabled: boolean;
  // Per-business payment/payout overrides (026)
  use_business_payment: boolean;
  has_business_payment_method: boolean;
  use_business_payout: boolean;
  business_stripe_onboarding_complete: boolean;
  business_stripe_payouts_enabled: boolean;
  // NFC
  nfc_token: string | null;
  /** True when a Stripe subscription exists. Replaces reading the id itself —
   *  every consumer only ever checked whether it was set. */
  subscription_connected: boolean;
  stripe_connected: boolean;
  business_stripe_connected: boolean;
  nfc_status: "none" | "requested" | "dispatched" | "active";
  // Bookings
  accepts_bookings: boolean;
};

export const BUSINESS_COLS =
  // Safe columns only. The private half — NFC token, Stripe state, payment
  // flags — now comes from business_private_fields(), which checks that the
  // caller actually owns this business. `authenticated` is every signed-in
  // user, so a column grant could never have been the ownership boundary.
  "id, owner_id, name, category, description, address, lat, lng, logo_url, cover_url, brand_color, tags, phone, website, email, slug, opening_hours, opening_hours_until, planner_visitor_ready, planner_dwell_minutes, planner_setting, planner_good_for, planner_booking, planner_note, is_verified, is_active, subscription_tier, subscription_until, accepts_wallet, cashback_percent, payout_enabled, accepts_bookings";

/* ── Plan model ───────────────────────────────────────────────────────────── */

/**
 * The tier ladder lives in lib/listing-tiers.ts — the one file mirrored into the
 * app repo, so both products agree on what a tier gets. Re-exported here so the
 * management dashboard keeps importing from one place.
 */
export {
  TIER_LABEL as TIER_LABELS,
  TIER_PRICE,
  TIER_PRICE_PENCE,
  PREMIUM_ANNUAL_PENCE,
  TIER_PITCH,
  TIER_FEATURES,
  PLAN_COMPARISON,
  PREMIUM_ANNUAL_PRICE,
  FREE_GALLERY_LIMIT,
  BOOKING_FEE_PENCE,
  BOOKING_CAP_UNITS,
  BOOKING_CAP_PENCE,
  galleryLimit,
  tierUnlocks,
  normaliseTier,
  type Feature,
  type ListingFeature,
  type ManageFeature,
} from "@/lib/listing-tiers";

import { TIER_FEATURES as TF, type Feature as Feat } from "@/lib/listing-tiers";

const TIER_RANK: Record<SubscriptionTier, number> = { free: 0, pro: 1, premium: 2 };

export function tierMeets(current: SubscriptionTier, required: SubscriptionTier): boolean {
  return TIER_RANK[current] >= TIER_RANK[required];
}

/** The tier a feature needs — for gating a manage page or writing an upgrade hint. */
export function tierFor(feature: Feat): SubscriptionTier {
  return TF[feature];
}

export function isOnBoost(b: Pick<ManagedBusiness, "subscription_tier" | "subscription_until" | "subscription_connected">): boolean {
  // A boost is Pro access with no subscription behind it. Reads the derived
  // flag now — the id was only ever checked for existence.
  return !b.subscription_connected && b.subscription_tier === "pro" && !!b.subscription_until && new Date(b.subscription_until) > new Date();
}

/* ── Offers / loyalty types ───────────────────────────────────────────────── */

export type DiscountType = "percent" | "fixed" | "freebie" | "bogo" | "other";
export type LocalOffer = {
  id: string; business_id: string; title: string; description: string | null;
  discount_type: DiscountType | null; discount_value: number | null;
  valid_from: string; valid_until: string; is_active: boolean; redemption_count: number;
  max_redemptions: number | null; created_at: string;
};
export type LoyaltyProgram = {
  id: string; business_id: string; type: "stamps" | "points";
  stamps_required: number | null; stamp_reward: string | null;
  reward_tiers: { stamps: number; reward: string }[] | null;
  points_per_pound: number | null; points_for_pound: number | null; is_active: boolean;
};
export type WalletReceipt = {
  id: string; created_at: string; gross_pence: number; fee_pence: number | null;
  cashback_pence: number | null; net_pence: number | null; customer_first_name: string | null;
};
/** Rotating at-till redemption code (table: local_business_codes). */
export type BusinessCode = { business_id: string; current_code: string; expires_at: string; updated_at: string };

export function formatOfferDiscount(o: Pick<LocalOffer, "discount_type" | "discount_value">): string {
  switch (o.discount_type) {
    case "percent": return `${o.discount_value ?? 0}% off`;
    case "fixed": return `£${((o.discount_value ?? 0)).toFixed(2)} off`;
    case "freebie": return "Freebie";
    case "bogo": return "2 for 1";
    default: return "Special offer";
  }
}
export function daysRemaining(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

/* ── Alerts types ─────────────────────────────────────────────────────────── */

export type AlertType = "emergency" | "disruption" | "info";
export type AlertAccessStatus = "requested" | "approved" | "active" | "rejected" | "suspended";
export type PartnerAlert = { id: string; business_id: string; business_name: string; message: string; type: AlertType; is_active: boolean; starts_at: string; expires_at: string | null; created_at: string };
export type AlertAccess = { id: string; business_id: string; status: AlertAccessStatus; requested_at: string; activated_at: string | null; policy_accepted_at: string | null };

export const ALERT_COLORS: Record<AlertType, { color: string; bg: string; label: string; icon: string }> = {
  emergency: { color: "#FF3B30", bg: "#FFF2F1", label: "Emergency", icon: "⚠️" },
  disruption: { color: "#FF9500", bg: "#FFF8EC", label: "Disruption", icon: "🚧" },
  info: { color: "#0A84FF", bg: "#EEF5FF", label: "Info", icon: "ℹ️" },
};

export const NFC_TILE_URL_PREFIX = "https://oneshetland.com/t/";
export const BIZ = "#7c3aed"; // Local/business accent
