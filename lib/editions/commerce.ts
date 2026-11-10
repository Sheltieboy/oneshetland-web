/**
 * Editions commerce (R4): pure types, copy, formatting and validators. No I/O. Everything a person reads about money lives here so it can be tested:
 * plain words, GBP in pounds and pence from integer pence, and one explanation for every reason payments might be closed.
 */
import type { Checked } from "./validate";
import { isUuid } from "./validate";

export const pounds = (pence: number | null | undefined): string => (pence == null ? "" : `£${(pence / 100).toFixed(2)}`);
/** "10" -> 1000, "10.5" -> 1050, "£1,250.00" -> 125000; anything else (negative, 3 decimals, letters) -> null. */
export function toPence(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) && raw >= 0 ? Math.round(raw * 100) : null;
  if (typeof raw !== "string") return null;
  let t = raw.trim().replace(/^£/, "");
  // a comma is only ever a thousands separator (1,250 or 1,250.50); "10,5" is ambiguous, so it is refused rather than guessed
  if (t.includes(",")) { if (!/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(t)) return null; t = t.replace(/,/g, ""); }
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(parseFloat(t) * 100);
}

export const BLOCKER_TEXT: Record<string, { title: string; fix: string }> = {
  payments_off: { title: "Payments are not switched on yet", fix: "OneShetland will tell you when you can start taking payments." },
  organiser_not_verified: { title: "Your organiser profile is not verified", fix: "OneShetland verifies who you are before you can take money." },
  no_collect_entitlement: { title: "Taking payments is not part of your package", fix: "Choose a package that includes it, or ask OneShetland." },
  terms_not_accepted: { title: "Accept the payment terms", fix: "An organiser owner needs to accept the current terms below." },
  no_payout_account: { title: "Connect your payout account", fix: "Connect with Stripe so your revenue can be paid to you." },
  payout_account_incomplete: { title: "Finish setting up your payout account", fix: "Stripe still needs a few details before it can pay you." },
  collection_suspended: { title: "Collection is paused", fix: "OneShetland has paused payments for your organiser. Contact support." },
  self_payment: { title: "You cannot pay your own organiser", fix: "Ask someone else on the team to record this payment instead." },
};
export const blockerText = (key: string | null | undefined) => (key ? BLOCKER_TEXT[key] ?? { title: "Payments are not available right now", fix: "Please try again later." } : null);

export type PayStatus = "pending" | "succeeded" | "failed" | "refunded" | "partially_refunded" | "disputed" | "voided";
export const PAY_STATUS_LABEL: Record<PayStatus, string> = { pending: "Pending", succeeded: "Paid", failed: "Failed", refunded: "Refunded", partially_refunded: "Part refunded", disputed: "Disputed", voided: "Voided" };
export const SOURCE_LABEL: Record<string, string> = { stripe: "Card", offline: "Recorded offline", complimentary: "Free (complimentary)" };
export const METHOD_LABEL: Record<string, string> = { cheque: "Cheque", bank_transfer: "Bank transfer", cash: "Cash", imported: "Imported record", other: "Other" };
export const VAT_LABEL: Record<string, string> = { none: "No VAT", inclusive: "Includes VAT", exclusive: "Plus VAT" };

export type MemberStatus = "applied" | "invited" | "pending_payment" | "active" | "past_due" | "cancel_at_period_end" | "cancelled" | "expired" | "declined" | "withdrawn";
export const MEMBER_STATUS: Record<MemberStatus, { label: string; tone: "good" | "wait" | "ask" | "bad" | "off" }> = {
  applied: { label: "Applied", tone: "ask" }, invited: { label: "Invited", tone: "wait" }, pending_payment: { label: "Awaiting payment", tone: "ask" }, active: { label: "Member", tone: "good" },
  past_due: { label: "Payment overdue", tone: "bad" }, cancel_at_period_end: { label: "Ending", tone: "wait" }, cancelled: { label: "Cancelled", tone: "off" }, expired: { label: "Expired", tone: "off" },
  declined: { label: "Declined", tone: "off" }, withdrawn: { label: "Withdrawn", tone: "off" },
};
export const INTERVAL_LABEL: Record<string, string> = { monthly: "per month", annual: "per year", offline: "paid outside OneShetland", complimentary: "free" };

export type Tier = {
  id: string; organiser_id: string; name: string; description: string | null; benefits: string[]; price_monthly_pence: number | null; price_annual_pence: number | null; is_free: boolean; vat_mode: string;
  join_mode: "open" | "application" | "invite_only"; edition_benefit: "none" | "free" | "percent_off"; edition_discount_percent: number | null; max_members: number | null; active: boolean; sort: number; version: number; archived_at: string | null;
};
export type PublicTier = { tier_id: string; organiser_id: string; organiser_name: string; name: string; description: string | null; benefits: string[]; price_monthly_pence: number | null; price_annual_pence: number | null; is_free: boolean; vat_mode: string; join_mode: string; edition_benefit: string; discount_percent: number | null; full: boolean };
export type OrgMember = { membership_id: string; business_id: string; business_name: string; tier_id: string; tier_name: string; status: MemberStatus; billing_interval: string | null; source: string; price_pence: number | null; current_period_end: string | null; joined_at: string | null; past_due_since: string | null; organiser_note: string | null; message: string | null; last_payment_at: string | null; last_payment_pence: number | null; live: boolean };
export type MyMembership = { membership_id: string; business_id: string; business_name: string; organiser_id: string; organiser_name: string; organiser_slug: string | null; tier_name: string; benefits: string[]; edition_benefit: string; discount_percent: number | null; status: MemberStatus; billing_interval: string | null; source: string; price_pence: number | null; vat_mode: string; current_period_end: string | null; cancel_requested_at: string | null; message: string | null; decision_note: string | null; can_pay: boolean; pay_blocker: string | null; live: boolean; created_at: string };
export type MyParticipation = { link_id: string; business_id: string; business_name: string; edition_id: string; edition_title: string; edition_slug: string; organiser_name: string; required: boolean; status: string; base_pence: number | null; discount_pence: number | null; price_pence: number | null; charge_pence: number | null; vat_pence: number | null; basis: string | null; refund_policy: string | null; refund_until: string | null; tier_name: string | null; shown: boolean; can_pay: boolean; pay_blocker: string | null };
export type ParticipationRow = { link_id: string; business_id: string; business_name: string; link_state: string; required: boolean; status: string; basis: string | null; quoted_charge_pence: number | null; discount_pence: number | null; paid_pence: number | null; shown: boolean; waiver_note: string | null };
export type OrgPayment = { payment_id: string; created_at: string; kind: "membership" | "participation"; business_name: string; source: string; status: PayStatus; price_pence: number; vat_pence: number; platform_fee_pence: number; stripe_fee_pence: number | null; charge_pence: number; net_to_organiser_pence: number; refunded_pence: number; method: string | null; period_start: string | null; period_end: string | null; note: string | null; ref_label: string | null };
export type MyPayment = { payment_id: string; created_at: string; organiser_name: string; kind: string; label: string | null; source: string; status: PayStatus; price_pence: number; vat_pence: number; charge_pence: number; refunded_pence: number; vat_mode: string; vat_number: string | null; legal_name: string | null; period_end: string | null };
export type StatementRow = { month: string; payments: number; gross_pence: number | null; vat_pence: number | null; platform_fee_pence: number | null; stripe_fee_pence: number | null; net_to_organiser_pence: number | null; refunded_pence: number | null; offline_pence: number | null };
export type Pkg = { id: string; code: string; name: string; description: string | null; price_pence: number; duration_days: number; features: string[]; max_members: number | null; active: boolean; sort: number; audience?: "any" | "hub" };
export type PayoutStatus = { organiser_id: string; details_submitted: boolean; charges_enabled: boolean; payouts_enabled: boolean; requirements_due: string[]; vat_registered: boolean; vat_number: string | null; legal_name: string | null; collection_suspended: boolean; suspended_reason: string | null };

export const FEATURE_LABEL: Record<string, string> = { collect_payments: "Take payments", memberships: "Memberships", offline_records: "Record offline payments", participation_fees: "Charge for Edition participation", csv_export: "Export to CSV" };

/** What a tier costs, in a sentence. */
export function tierPriceText(t: Pick<Tier, "is_free" | "price_monthly_pence" | "price_annual_pence" | "vat_mode">): string {
  if (t.is_free) return "Free";
  const parts = [t.price_monthly_pence != null ? `${pounds(t.price_monthly_pence)} a month` : null, t.price_annual_pence != null ? `${pounds(t.price_annual_pence)} a year` : null].filter(Boolean);
  return `${parts.join(" or ")}${t.vat_mode === "exclusive" ? " plus VAT" : t.vat_mode === "inclusive" ? " including VAT" : ""}`;
}
export function benefitText(t: { edition_benefit: string; edition_discount_percent?: number | null; discount_percent?: number | null }): string | null {
  if (t.edition_benefit === "free") return "Free participation in this organiser's Editions";
  if (t.edition_benefit === "percent_off") return `${t.edition_discount_percent ?? t.discount_percent}% off participation in this organiser's Editions`;
  return null;
}

/* ── validators (form -> clean RPC arguments) ──────────────────────────────────────────────────────────────────── */
const trim = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export type TierInput = { name: string; description: string | null; benefits: string[]; monthly: number | null; annual: number | null; free: boolean; vat_mode: "none" | "inclusive" | "exclusive"; join_mode: "open" | "application" | "invite_only"; edition_benefit: "none" | "free" | "percent_off"; discount: number | null; max_members: number | null };
export function tierFields(i: Record<string, unknown>): Checked<TierInput> {
  const name = trim(i.name), description = trim(i.description), free = i.free === true;
  if (name.length < 2 || name.length > 80) return fail("Give the tier a name of 2 to 80 characters.");
  if (description.length > 600) return fail("The description must be 600 characters or fewer.");
  const benefits = trim(i.benefits).split("\n").map((l) => l.trim()).filter(Boolean);
  if (benefits.length > 12) return fail("List up to 12 benefits.");
  if (benefits.some((b) => b.length > 120)) return fail("Each benefit must be 120 characters or fewer.");
  let monthly: number | null = null, annual: number | null = null;
  if (!free) {
    monthly = trim(i.monthly) ? toPence(i.monthly) : null; annual = trim(i.annual) ? toPence(i.annual) : null;
    if ((trim(i.monthly) && monthly === null) || (trim(i.annual) && annual === null)) return fail("Prices must be amounts like 10 or 10.50.");
    if (monthly === null && annual === null) return fail("Set a monthly price, a yearly price, or choose a free tier.");
    if ((monthly !== null && monthly < 100) || (annual !== null && annual < 100)) return fail("The lowest price is £1.00.");
    if ((monthly ?? 0) > 1_000_000 || (annual ?? 0) > 10_000_000) return fail("That price is above the allowed limit.");
  }
  const vat = i.vat_mode === "inclusive" || i.vat_mode === "exclusive" ? i.vat_mode : "none";
  const join = i.join_mode === "open" || i.join_mode === "invite_only" ? i.join_mode : "application";
  const ben = i.edition_benefit === "free" || i.edition_benefit === "percent_off" ? i.edition_benefit : "none";
  let discount: number | null = null;
  if (ben === "percent_off") { discount = Number(i.discount); if (!Number.isInteger(discount) || discount < 1 || discount > 99) return fail("Choose a discount between 1% and 99%."); }
  const max = trim(i.max_members) ? Number(i.max_members) : null;
  if (max !== null && (!Number.isInteger(max) || max < 1 || max > 100000)) return fail("The member limit must be a whole number of 1 or more.");
  return { ok: true, value: { name, description: description || null, benefits, monthly, annual, free, vat_mode: vat, join_mode: join, edition_benefit: ben, discount, max_members: max } };
}

export type TermsInput = { mode: "free" | "fee_required"; fee: number | null; vat_mode: "none" | "inclusive" | "exclusive"; refund_policy: "none" | "until_date" | "full"; refund_until: string | null; capacity: number | null; closes: string | null };
export function termsFields(i: Record<string, unknown>): Checked<TermsInput> {
  const mode = i.mode === "fee_required" ? "fee_required" : "free";
  let fee: number | null = null;
  if (mode === "fee_required") { fee = toPence(i.fee); if (fee === null || fee < 100) return fail("The participation fee must be at least £1.00."); if (fee > 10_000_000) return fail("That fee is above the allowed limit."); }
  const rp = i.refund_policy === "full" || i.refund_policy === "until_date" ? i.refund_policy : "none";
  const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null);
  const until = rp === "until_date" ? date(i.refund_until) : null;
  if (rp === "until_date" && !until) return fail("Choose the last day on which a refund can be given.");
  const closes = trim(i.closes) ? date(i.closes) : null; if (trim(i.closes) && !closes) return fail("Choose a valid closing date.");
  const cap = trim(i.capacity) ? Number(i.capacity) : null; if (cap !== null && (!Number.isInteger(cap) || cap < 1)) return fail("Capacity must be a whole number of 1 or more.");
  const vat = i.vat_mode === "inclusive" || i.vat_mode === "exclusive" ? i.vat_mode : "none";
  return { ok: true, value: { mode, fee, vat_mode: vat, refund_policy: rp, refund_until: until, capacity: cap, closes } };
}

export function vatFields(i: Record<string, unknown>): Checked<{ registered: boolean; vat_number: string | null; legal_name: string | null }> {
  const registered = i.registered === true, vat = trim(i.vat_number).toUpperCase().replace(/\s+/g, ""), legal = trim(i.legal_name);
  if (legal && (legal.length < 2 || legal.length > 160)) return fail("The legal name must be 2 to 160 characters.");
  if (registered && !vat) return fail("Enter your VAT number, or untick VAT registered.");
  if (vat && !/^(GB)?\d{9}(\d{3})?$/.test(vat)) return fail("A UK VAT number is 9 or 12 digits, for example GB123456789.");
  return { ok: true, value: { registered, vat_number: vat || null, legal_name: legal || null } };
}

export type OfflineInput = { amount: number | null; method: string | null; note: string; start: string | null; end: string; kind: "offline" | "complimentary" };
export function offlineFields(i: Record<string, unknown>): Checked<OfflineInput> {
  const kind = i.kind === "complimentary" ? "complimentary" : "offline", note = trim(i.note);
  if (note.length < 3) return fail(kind === "offline" ? "Add a note, such as the cheque number or transfer reference." : "Say why this is free.");
  if (note.length > 500) return fail("The note must be 500 characters or fewer.");
  const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null);
  const end = date(i.end); if (!end) return fail("Choose when the membership ends.");
  const start = trim(i.start) ? date(i.start) : null; if (trim(i.start) && !start) return fail("Choose a valid start date.");
  if (start && Date.parse(end) <= Date.parse(start)) return fail("The end date must be after the start date.");
  let amount: number | null = null, method: string | null = null;
  if (kind === "offline") {
    amount = toPence(i.amount); if (amount === null) return fail("Enter the amount received, like 50 or 50.00.");
    method = ["cheque", "bank_transfer", "cash", "imported", "other"].includes(String(i.method)) ? String(i.method) : null; if (!method) return fail("Say how it was paid.");
  }
  return { ok: true, value: { amount, method, note, start, end, kind } };
}

export const commerceId = (v: unknown): v is string => isUuid(v);

/** CSV for the organiser's payments (RFC 4180; formula-injection safe for spreadsheets). */
export function paymentsCsv(rows: OrgPayment[]): string {
  const cell = (v: unknown) => { let s = v == null ? "" : String(v); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const head = ["Date", "Type", "Business", "For", "Source", "Method", "Status", "Price", "VAT", "Charged", "Platform fee", "Net to organiser", "Refunded", "Note"];
  const lines = rows.map((r) => [r.created_at.slice(0, 10), r.kind, r.business_name, r.ref_label ?? "", SOURCE_LABEL[r.source] ?? r.source, r.method ? METHOD_LABEL[r.method] ?? r.method : "", PAY_STATUS_LABEL[r.status] ?? r.status,
    (r.price_pence / 100).toFixed(2), (r.vat_pence / 100).toFixed(2), (r.charge_pence / 100).toFixed(2), (r.platform_fee_pence / 100).toFixed(2), (r.net_to_organiser_pence / 100).toFixed(2), (r.refunded_pence / 100).toFixed(2), r.note ?? ""]);
  return [head, ...lines].map((l) => l.map(cell).join(",")).join("\r\n") + "\r\n";
}
