/** The admin commercial model: which settings exist, what they mean, how they are validated (mirrors the SQL), and the fee calculator. Pure. */
export type ConfigKey = { key: string; label: string; help: string; kind: "bool" | "percent" | "pence" | "pence_or_blank" | "choice" | "days" | "text" | "int" | "onoff" | "note"; choices?: string[]; def: string; min?: number; max?: number; group?: "promo" | "app" };
export const COMMERCE_KEYS: ConfigKey[] = [
  { key: "editions.commerce.enabled", label: "Payments switched on", help: "The master switch. Off means no money can be taken anywhere in Editions.", kind: "bool", def: "false" },
  { key: "editions.commerce.fee_payer", label: "Who pays the platform fee", help: "Organiser: the fee comes out of the price. Business: the fee is added on top, so the organiser receives the full price.", kind: "choice", choices: ["organiser", "business"], def: "organiser" },
  { key: "editions.commerce.participation.fee_percent", label: "Participation fee: percent", help: "Taken from each Edition participation payment.", kind: "percent", def: "5" },
  { key: "editions.commerce.participation.fee_fixed_pence", label: "Participation fee: fixed pence", help: "Added to the percentage, in pence.", kind: "pence", def: "0" },
  { key: "editions.commerce.participation.fee_min_pence", label: "Participation fee: minimum pence", help: "Never less than this (but never more than the price).", kind: "pence", def: "0" },
  { key: "editions.commerce.participation.fee_cap_pence", label: "Participation fee: cap pence", help: "Never more than this. Leave blank for no cap.", kind: "pence_or_blank", def: "" },
  { key: "editions.commerce.membership.fee_percent", label: "Membership fee: percent", help: "Taken from each membership payment. On card subscriptions it is applied as a percentage of each invoice.", kind: "percent", def: "5" },
  { key: "editions.commerce.membership.fee_fixed_pence", label: "Membership fee: fixed pence", help: "Added to the percentage, in pence (not applied to card subscriptions, which only support a percentage).", kind: "pence", def: "0" },
  { key: "editions.commerce.membership.fee_min_pence", label: "Membership fee: minimum pence", help: "Never less than this.", kind: "pence", def: "0" },
  { key: "editions.commerce.membership.fee_cap_pence", label: "Membership fee: cap pence", help: "Never more than this. Leave blank for no cap.", kind: "pence_or_blank", def: "" },
  { key: "editions.commerce.grace_days", label: "Grace period (days)", help: "How long a member keeps benefits after a failed renewal.", kind: "days", def: "14" },
  { key: "editions.commerce.max_charge_pence", label: "Largest single charge (pence)", help: "Any payment above this is refused.", kind: "pence", def: "500000" },
  { key: "editions.commerce.refund_application_fee", label: "Refund the platform fee on refunds", help: "When a payment is refunded, return OneShetland's fee too.", kind: "bool", def: "true" },
  { key: "editions.commerce.vat_rate_percent", label: "VAT rate (percent)", help: "Used only for VAT-registered organisers. Needs accountant sign-off before live use.", kind: "percent", def: "20" },
  { key: "editions.commerce.terms_version", label: "Current commercial terms version", help: "Changing this asks every organiser to accept the new terms before they can take payments.", kind: "text", def: "draft-1" },
  { key: "editions.promo.homepage_capacity", label: "Homepage places per day", help: "How many Editions may be booked on the homepage on any one day. 1 to 50.", kind: "int", min: 1, max: 50, def: "3", group: "promo" },
  { key: "editions.promo.discovery_capacity", label: "Enhanced discovery places per day", help: "How many Editions may be booked for enhanced discovery on any one day. 1 to 50.", kind: "int", min: 1, max: 50, def: "6", group: "promo" },
  { key: "editions.promo.homepage_visible", label: "Homepage cards shown", help: "How many booked Editions the homepage strip shows at once (a daily rotation). 1 to 12. The strip itself never shows more than 3.", kind: "int", min: 1, max: 12, def: "3", group: "promo" },
  { key: "editions.promo.discovery_visible", label: "Promoted cards shown on the Editions list", help: "How many booked Editions the Promoted row shows at once. 1 to 12. The row itself never shows more than 4.", kind: "int", min: 1, max: 12, def: "4", group: "promo" },
  { key: "editions.promo.lead_days", label: "Earliest start: days from today", help: "Organisers cannot book a start sooner than this. 0 to 30.", kind: "int", min: 0, max: 30, def: "2", group: "promo" },
  { key: "editions.promo.horizon_days", label: "How far ahead organisers can book (days)", help: "The furthest start date that can be booked. 1 to 730.", kind: "int", min: 1, max: 730, def: "180", group: "promo" },
  { key: "editions.promo.homepage_days_per_90", label: "Homepage days per organiser in any 90 days", help: "Keeps the homepage fair: no organiser can exceed this across all its Editions. 0 to 90.", kind: "int", min: 0, max: 90, def: "14", group: "promo" },
  { key: "editions.promo.reschedule_notice_days", label: "Notice needed to move or cancel (days)", help: "Organisers can change a booking only if it starts at least this many days away. Staff are not held to it. 0 to 60.", kind: "int", min: 0, max: 60, def: "3", group: "promo" },
  { key: "editions.commerce.renewal_window_days", label: "Renewal window (days)", help: "A package can be bought again only in the last this-many days of the current publishing period. 0 to 365.", kind: "int", min: 0, max: 365, def: "30", group: "promo" },
  { key: "editions.commerce.vat_note", label: "Note shown beside prices", help: "One short line shown next to each price (for example about VAT). Leave blank for none. Up to 300 characters, no angle brackets. No VAT is calculated anywhere.", kind: "note", def: "", group: "promo" },
  { key: "editions.app.handoff_ios", label: "Allow app-to-website sign-in for organisers (iPhone)", help: "Off by default. Warning: when on, an organiser signed in to the iPhone app can open their organiser pages on the website without signing in again, using a one-use code that lasts 60 seconds. Purchase and promotion pages are never opened this way. Turn on only after the security review.", kind: "onoff", def: "off", group: "app" },
  { key: "editions.app.handoff_android", label: "Allow app-to-website sign-in for organisers (Android)", help: "Off by default. Warning: when on, an organiser signed in to the Android app can open their organiser pages on the website without signing in again, using a one-use code that lasts 60 seconds. Purchase and promotion pages are never opened this way. Turn on only after the security review.", kind: "onoff", def: "off", group: "app" },
];
const k = (key: string) => COMMERCE_KEYS.find((c) => c.key === key);
export function validateConfigValue(key: string, raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const c = k(key); if (!c) return { ok: false, error: "That setting does not exist." };
  const v = String(raw ?? "").trim();
  switch (c.kind) {
    case "bool": return v === "true" || v === "false" ? { ok: true, value: v } : { ok: false, error: "Choose on or off." };
    case "choice": return c.choices!.includes(v) ? { ok: true, value: v } : { ok: false, error: "Choose one of the options." };
    case "percent": return /^\d{1,2}(\.\d{1,2})?$/.test(v) && Number(v) <= (key.endsWith("vat_rate_percent") ? 30 : 50) ? { ok: true, value: v } : { ok: false, error: `Enter a percentage up to ${key.endsWith("vat_rate_percent") ? 30 : 50}, like 5 or 2.5.` };
    case "pence": return /^\d{1,7}$/.test(v) && (!key.endsWith("max_charge_pence") || (v.length >= 3)) ? { ok: true, value: v } : { ok: false, error: "Enter a whole number of pence." };
    case "pence_or_blank": return v === "" || /^\d{1,7}$/.test(v) ? { ok: true, value: v } : { ok: false, error: "Enter a whole number of pence, or leave blank." };
    case "days": return /^\d{1,2}$/.test(v) && Number(v) <= 60 ? { ok: true, value: v } : { ok: false, error: "Enter 0 to 60 days." };
    case "int": { const n = Number(v); return /^\d{1,3}$/.test(v) && n >= (c.min ?? 0) && n <= (c.max ?? 999) ? { ok: true, value: String(n) } : { ok: false, error: `Enter a whole number from ${c.min ?? 0} to ${c.max ?? 999}.` }; }
    case "onoff": return v === "on" || v === "off" ? { ok: true, value: v } : { ok: false, error: "Choose on or off." };
    case "note": return v.length <= 300 && !/[<>\u0000-\u001f\u007f]/.test(v) ? { ok: true, value: v } : { ok: false, error: "Up to 300 characters, with no angle brackets or line breaks." };
    case "text": return /^[A-Za-z0-9._-]{1,20}$/.test(v) ? { ok: true, value: v } : { ok: false, error: "Use up to 20 letters, numbers, dots, dashes or underscores." };
  }
}

/** The same maths as the database (edition_fee_calc / edition_charge_breakdown), so an admin can preview a price before changing a setting. */
export type FeeConfig = { percent: number; fixed: number; min: number; cap: number | null; payer: "organiser" | "business"; vatRate: number };
export function previewFee(price: number, cfg: FeeConfig, vat: "none" | "inclusive" | "exclusive", vatRegistered: boolean, stripeFee?: number) {
  let vatPence = 0, gross = price; const mode = vatRegistered ? vat : "none";
  if (mode === "inclusive") vatPence = Math.round(price - price / (1 + cfg.vatRate / 100));
  if (mode === "exclusive") { vatPence = Math.round(price * cfg.vatRate / 100); gross = price + vatPence; }
  let fee = price <= 0 ? 0 : Math.round(gross * cfg.percent / 100) + cfg.fixed;
  fee = Math.max(fee, cfg.min); if (cfg.cap !== null) fee = Math.min(fee, cfg.cap); fee = Math.min(fee, gross);
  const charge = cfg.payer === "business" ? gross + fee : gross;
  const platformMargin = stripeFee === undefined ? null : fee - stripeFee;
  return { price, vatPence, fee, charge, net: charge - fee, platformMargin, belowCost: platformMargin !== null && platformMargin < 0 };
}
