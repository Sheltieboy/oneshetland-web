/**
 * money.ts — the wording and rule for tests that involve REAL money.
 *
 * The Test Centre never captures card details, never calls a payment provider and never moves value; it only tells the tester what the live app
 * will do and records that they understood. No refund is ever promised here — only an administrator's own `help_text` can say anything about that.
 */
import type { MoneyType } from "./types.ts";

export const NEVER_SHARE_NOTICE =
  "Please never put card numbers, bank details, passwords or any other payment secret in a note or a screenshot. If a screenshot shows one, cover it up first.";

export const ACK_LABEL = "I understand this is a real transaction.";

export function requiresAck(t: { money_test_type: MoneyType }): boolean { return t.money_test_type !== "none"; }

export function formatMaxSpend(pence: number | null | undefined): string | null {
  if (pence == null) return null;
  if (pence === 0) return "£0.00";
  return `£${(pence / 100).toFixed(2)}`;
}

export function moneyWarning(t: { money_test_type: MoneyType; expected_max_spend_pence: number | null }): { headline: string; body: string; spend: string | null } | null {
  if (t.money_test_type === "none") return null;
  const body = {
    wallet: "This uses the live OneShetland payment system and real value from your OneShetland Wallet.",
    real_card: "This uses the live OneShetland payment system and your own real bank card.",
    donation: "This sends a real donation through the live OneShetland payment system.",
  }[t.money_test_type];
  const max = formatMaxSpend(t.expected_max_spend_pence);
  return { headline: "REAL MONEY TEST", body, spend: max ? `Expected spend: no more than ${max}.` : null };
}
