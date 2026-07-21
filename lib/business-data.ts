/**
 * business-data.ts — shared types/constants/helpers for the web "Manage
 * Business" dashboard. Mirrors the app's lib/local-api.ts (the management side).
 * Client-safe: NO next/headers. Auth-scoped reads live in business-data.server.ts;
 * writes/edge-function calls live in lib/business-client.ts.
 */

export type SubscriptionTier = "free" | "pro" | "premium";

export type AddonKey =
  | "bookings" | "services" | "events" | "membership" | "products"
  | "offers" | "stamps" | "enquiries" | "payments" | "featured" | "jobs";

export const PREMIUM_ADDON_KEYS: AddonKey[] = ["bookings", "services", "events", "membership", "products"];
export const STANDARD_ADDON_KEYS: AddonKey[] = ["offers", "stamps", "enquiries", "payments", "featured", "jobs"];
export const EXTRA_ADDON_MONTHLY_PENCE = 1000; // £10 per additional premium add-on

export type BusinessAddon = { id: string; business_id: string; addon_key: AddonKey; enabled: boolean; config: Record<string, unknown>; created_at: string };

/** The full management view of a business (owner-readable row). */
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
  is_verified: boolean;
  is_active: boolean;
  // Subscription
  subscription_tier: SubscriptionTier;
  subscription_until: string | null;
  subscription_cancel_at_period_end: boolean | null;
  stripe_subscription_id: string | null;
  // Wallet + central/business payout
  accepts_wallet: boolean;
  cashback_percent: number;
  payout_enabled: boolean;
  stripe_account_id: string | null;
  // Per-business payment/payout overrides (026)
  use_business_payment: boolean;
  has_business_payment_method: boolean;
  use_business_payout: boolean;
  business_stripe_onboarding_complete: boolean;
  business_stripe_payouts_enabled: boolean;
  // NFC
  nfc_token: string | null;
  nfc_status: "none" | "requested" | "dispatched" | "active";
  // Bookings
  accepts_bookings: boolean;
};

export const BUSINESS_COLS =
  "id, owner_id, name, category, description, address, lat, lng, logo_url, cover_url, brand_color, tags, phone, website, email, slug, is_verified, is_active, subscription_tier, subscription_until, subscription_cancel_at_period_end, stripe_subscription_id, accepts_wallet, cashback_percent, payout_enabled, stripe_account_id, use_business_payment, has_business_payment_method, use_business_payout, business_stripe_onboarding_complete, business_stripe_payouts_enabled, nfc_token, nfc_status, accepts_bookings";

/* ── Plan model ───────────────────────────────────────────────────────────── */

export const TIER_LABELS: Record<SubscriptionTier, string> = { free: "Free", pro: "Pro", premium: "Premium" };
export const TIER_PRICE: Record<SubscriptionTier, string> = { free: "£0", pro: "£19.99/mo", premium: "£49.99/mo" };
const TIER_RANK: Record<SubscriptionTier, number> = { free: 0, pro: 1, premium: 2 };

export function tierMeets(current: SubscriptionTier, required: SubscriptionTier): boolean {
  return TIER_RANK[current] >= TIER_RANK[required];
}

export const PLAN_FEATURES: { label: string; req: SubscriptionTier }[] = [
  { label: "Directory listing", req: "free" },
  { label: "Loyalty programme", req: "pro" },
  { label: "Time-limited offers", req: "pro" },
  { label: "Local Wallet payments", req: "pro" },
  { label: "NFC tap-to-stamp tile", req: "pro" },
  { label: "In-app bookings", req: "premium" },
  { label: "Featured homepage spot", req: "premium" },
];

export function isOnBoost(b: Pick<ManagedBusiness, "subscription_tier" | "subscription_until" | "stripe_subscription_id">): boolean {
  return !b.stripe_subscription_id && b.subscription_tier === "pro" && !!b.subscription_until && new Date(b.subscription_until) > new Date();
}

/* ── Add-on metadata ──────────────────────────────────────────────────────── */

export const ADDON_META: Record<AddonKey, { label: string; description: string; icon: string; isPremium: boolean }> = {
  bookings: { label: "Bookings", description: "Take appointments and reservations in-app", icon: "📅", isPremium: true },
  services: { label: "Services", description: "List bookable services with prices", icon: "🛠️", isPremium: true },
  events: { label: "Events", description: "Create events and sell tickets", icon: "🎟️", isPremium: true },
  membership: { label: "Membership", description: "Offer paid memberships", icon: "🪪", isPremium: true },
  products: { label: "Products", description: "Showcase products for sale", icon: "🛍️", isPremium: true },
  offers: { label: "Offers", description: "Time-limited deals and discounts", icon: "🏷️", isPremium: false },
  stamps: { label: "Stamps & points", description: "Loyalty card with rewards", icon: "📇", isPremium: false },
  enquiries: { label: "Enquiries", description: "Let customers message you", icon: "✉️", isPremium: false },
  payments: { label: "Payments", description: "Accept Local Wallet payments", icon: "💳", isPremium: false },
  featured: { label: "Featured promotion", description: "Boosted placement in Local", icon: "⭐", isPremium: false },
  jobs: { label: "Jobs", description: "Post roles and take applications — free", icon: "💼", isPremium: false },
};

export function countExtraPremiumAddons(addons: BusinessAddon[]): number {
  const enabledPremium = addons.filter((a) => a.enabled && PREMIUM_ADDON_KEYS.includes(a.addon_key)).length;
  return Math.max(0, enabledPremium - 1);
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
export type AlertAccess = { id: string; business_id: string; status: AlertAccessStatus; requested_at: string; activated_at: string | null };

export const ALERT_COLORS: Record<AlertType, { color: string; bg: string; label: string; icon: string }> = {
  emergency: { color: "#FF3B30", bg: "#FFF2F1", label: "Emergency", icon: "⚠️" },
  disruption: { color: "#FF9500", bg: "#FFF8EC", label: "Disruption", icon: "🚧" },
  info: { color: "#0A84FF", bg: "#EEF5FF", label: "Info", icon: "ℹ️" },
};

export const NFC_TILE_URL_PREFIX = "https://oneshetland.com/t/";
export const BIZ = "#7c3aed"; // Local/business accent
