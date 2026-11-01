/**
 * nfc-wording.ts — what customer-facing screens say about the NFC tap-to-stamp tile.
 *
 * The tile FEATURE is built (a business can register for one, the stamp link and the till exist) but physical tiles are not yet being produced or
 * posted. So nothing may say a tile is included, available now, or will arrive by a date. One place holds the words so every screen agrees and a test
 * can pin them. The plan permissions and prices are not touched: this is wording only.
 */
export const NFC_SOON = "Coming soon";

/** The plan-comparison row, as shown on the billing page. (The shared tier model keeps its own label; the app mirrors that file.) */
export const nfcRowLabel = (label: string) => (label === "Tap-to-stamp NFC tile" ? "Tap-to-stamp NFC tile (coming soon)" : label);

/** The shared Pro blurb names "tap-to-stamp"; say it is coming rather than included. Other tiers' blurbs are unchanged. */
export function nfcPitch(blurb: string): string {
  if (!blurb.includes("tap-to-stamp, ")) return blurb;
  return `${blurb.replace("tap-to-stamp, ", "")} Tap-to-stamp tiles are coming soon.`;
}

/** The "NFC tile" card on the billing page, by state. `dispatched` and `active` only occur once a tile has genuinely been posted. */
export function nfcCardText(status: string | null | undefined): { line: string; button: string | null } {
  switch (status) {
    case "active": return { line: "✓ Active — customers can tap to collect a stamp.", button: null };
    case "dispatched": return { line: "Posted — stick it on the counter and tap it once with the app to activate.", button: null };
    case "requested": return { line: "You're on the waiting list. We'll email you when tiles are ready to post — there's no delivery date yet.", button: null };
    default: return { line: "Tap-to-stamp tiles are coming soon. Join the waiting list and we'll let you know when they're ready. Nothing is posted yet.", button: "Join the tile waiting list" };
  }
}

export const NFC_NEEDS_ADDRESS = "Add your address (with a map location) in Profile before joining the tile waiting list.";
