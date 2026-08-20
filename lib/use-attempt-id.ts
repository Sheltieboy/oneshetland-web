"use client";

import { useEffect, useRef } from "react";
import { newCheckoutAttemptId } from "./checkout-attempt";

/**
 * One payment reference per logical purchase, minted where the customer commits.
 *
 * WHY IT LIVES IN THE COMPONENT AND NOT IN THE API HELPER
 *
 * `payWithWallet` used to mint its own id on every call. That protects against a
 * dropped connection being retried by the HTTP layer — the same body, the same
 * id — but not against the person clicking "Pay" twice, which is the case that
 * actually happens. The second click ran the whole function again, minted a
 * fresh id, and bought the thing a second time.
 *
 * So the id is held here, across renders, for as long as the purchase is the
 * same purchase:
 *
 *   first click  → mint, remember
 *   retry        → the SAME id, so the server resolves it to the first attempt
 *   change the amount, the tier, the item → a new purchase, so a new id
 *
 * @param resetKey Anything that means "this is now a different purchase".
 *                 Changing it discards the held id.
 */
export function useAttemptId(resetKey: unknown): () => string {
  const ref = useRef<string | null>(null);

  useEffect(() => {
    ref.current = null;
  }, [resetKey]);

  // Lazy: nothing is minted until the customer actually commits, so opening and
  // closing a modal does not burn references.
  return () => {
    if (!ref.current) ref.current = newCheckoutAttemptId();
    return ref.current;
  };
}
