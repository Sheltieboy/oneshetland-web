import type { ReactNode } from "react";
import type { ModelItem, ModelOffer, ModelPass, ModelService } from "@/lib/business-page/types";

/**
 * Business Page V2 — where the REAL interactive actions plug in.
 *
 * The page renders the same layout whether or not a slot is filled. Today none is (the page links to the existing
 * flows); when an existing widget is ported it is passed here and appears in exactly the place reserved for it, with
 * no redesign. Every slot receives plain model data and must itself decide what a signed-out visitor sees.
 * Slots are only ever called with GENUINE items: in prepared mode, example items never receive a slot, so an
 * example can never be bought, claimed, booked or followed.
 */
export interface BusinessPageSlots {
  /** Hero, beside the primary actions. e.g. the Follow button. */
  follow?: (b: { businessId: string; accent: string }) => ReactNode;
  /** Footer of a REAL product card, beside the price. e.g. "Add to basket" / product purchase. */
  productAction?: (p: ModelItem) => ReactNode;
  /** Inside a REAL offer card. e.g. "Claim offer". */
  offerAction?: (o: ModelOffer, businessId: string) => ReactNode;
  /** Inside a REAL bookable service card. e.g. the slot picker. Replaces the default "Book" link. */
  bookAction?: (s: ModelService, businessId: string) => ReactNode;
  /** Inside a REAL pass / experience card. e.g. pass purchase. */
  passAction?: (p: ModelPass, businessId: string) => ReactNode;
  /** Below a REAL rewards programme. e.g. the member's own progress. */
  rewardsProgress?: (businessId: string) => ReactNode;
}
