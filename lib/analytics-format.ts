/**
 * analytics-format.ts — pure helpers for the owner analytics dashboard (/admin/analytics): money formatting, the revenue arithmetic shown on screen, and the
 * one-line definition of every KPI. No I/O. Tolerant of an older database (before migration 20261130000000) whose RPCs lack the newer fields.
 */
export const gbp = (pence: number | null | undefined) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format((pence ?? 0) / 100);

export const num = (n: number | null | undefined) => new Intl.NumberFormat("en-GB").format(n ?? 0);

export interface RevenueStreamV2 {
  stream: string; orders: number; gross_pence: number;
  refunded_pence?: number; net_pence?: number; platform_pence?: number | null; fees_pence?: number;
}

/** Net = gross - refunded, whichever the database supplied. */
export const streamNet = (s: RevenueStreamV2) => s.net_pence ?? (s.gross_pence ?? 0) - (s.refunded_pence ?? 0);

/** Wallet top-ups are stored customer funds, never sales. A stream carrying one (older database) is filtered out of sales totals. */
export const isWalletFloat = (s: RevenueStreamV2) => /^wallet/i.test(s.stream);

export function salesTotals(streams: RevenueStreamV2[]) {
  const sales = streams.filter((s) => !isWalletFloat(s));
  return {
    orders: sales.reduce((a, s) => a + (s.orders ?? 0), 0),
    gross: sales.reduce((a, s) => a + (s.gross_pence ?? 0), 0),
    refunded: sales.reduce((a, s) => a + (s.refunded_pence ?? 0), 0),
    net: sales.reduce((a, s) => a + streamNet(s), 0),
    platform: sales.reduce((a, s) => a + (s.platform_pence ?? 0), 0),
    platformUnknown: sales.some((s) => s.platform_pence === null || s.platform_pence === undefined),
  };
}

/** What each headline figure means. Shown on the dashboard so nobody has to guess. */
export const KPI_DEFINITIONS: Record<string, string> = {
  events: "Recorded actions (views, searches, taps, purchases) from opted-in visitors and signed-in members, after excluding internal/test activity, repeats and orphaned records.",
  conversions: "Reportable events the system marks as business outcomes (a purchase, booking, application, contact, share). Server-recorded purchases count once per order and only while the order still exists.",
  registrations: "New accounts created in the period (from the account system, not from tracking). Internal and test accounts excluded. Includes accounts that never confirmed their e-mail.",
  confirmed: "Of those registrations, accounts whose e-mail address has been confirmed.",
  signedIn: "Different signed-in members who generated at least one reportable event (counted by account ID). Only people who opted in to analytics.",
  anonymous: "Different opted-in browsers/devices that never signed in. Anyone who also signed in is counted as a signed-in member, not here. Not a total traffic count: people who decline analytics are not counted.",
  gross: "What customers paid through OneShetland for tickets, shop orders, passes, gifts, deposits, donations, memberships, deliveries and OneShetland products, before refunds. Wallet top-ups are NOT included.",
  net: "Gross sales minus refunds.",
  platform: "What OneShetland keeps: commission and fees on marketplace sales, and 100% of boosts, after refunds. A dash means that stream does not record OneShetland's share.",
  wallet: "Money customers have put into, spent from and been refunded to their OneShetland wallet. These are customer funds, not sales and not revenue; wallet spending that buys something is already counted in the stream it bought.",
  subscriptions: "Paid business plans currently active (a live Stripe subscription), priced at the list price. An estimate: invoice amounts are not stored. Complimentary launch-plan access is shown separately and is not income.",
};

export interface ExcludedCounts { raw_events?: number; internal_or_test?: number; unmatched_ledger?: number; duplicate_ledger?: number }

export const excludedTotal = (x: ExcludedCounts | undefined) => (x?.internal_or_test ?? 0) + (x?.unmatched_ledger ?? 0) + (x?.duplicate_ledger ?? 0);
