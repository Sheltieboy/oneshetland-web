"use client";

/**
 * BasketPill — the way back into the basket.
 *
 * WHAT WAS WRONG
 *
 * Adding something to the basket showed a "View basket" button for 2.5 seconds
 * (AddToBasket sets `added`, then a timer clears it) and that was the ONLY
 * route to /basket anywhere on the site. Once it vanished the customer had no
 * way back, so a web marketplace purchase could not reasonably be finished.
 *
 * The basket itself was never lost — lib/basket.ts persists to localStorage and
 * already exposed subscribeBasket "so the header pill stays live". The pill it
 * was written for had simply never been built: basketCount() had no callers.
 *
 * WHY IT HIDES WHEN EMPTY
 *
 * The marketplace is one section of a community site, not a storefront. A cart
 * icon permanently in the header of What's On would be an ecommerce chrome this
 * site does not otherwise have. It appears the moment there is something in it
 * and stays until the basket is empty, which is when it is needed.
 *
 * The count is read from the basket store on every change rather than kept
 * alongside it, so it cannot drift; the storage listener keeps a second tab in
 * step.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { basketCount, subscribeBasket } from "@/lib/basket";

const SHOP = "#4f46e5";

export function BasketPill() {
  // Starts at 0 on the server and on first paint: localStorage does not exist
  // during SSR, and reading it during render would be a hydration mismatch.
  const [count, setCount] = useState(0);

  useEffect(() => {
    const read = () => setCount(basketCount());
    read();
    const unsubscribe = subscribeBasket(read);
    // Another tab changing the basket fires storage, not our subscriber.
    const onStorage = (e: StorageEvent) => { if (e.key === null || e.key === "os_basket_v1") read(); };
    window.addEventListener("storage", onStorage);
    return () => { unsubscribe(); window.removeEventListener("storage", onStorage); };
  }, []);

  if (count === 0) return null;

  return (
    <Link
      href="/basket"
      aria-label={`Basket, ${count} item${count === 1 ? "" : "s"}`}
      className="relative grid h-9 w-9 place-items-center rounded-full border border-line-strong text-ink transition-colors hover:bg-sand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{ outlineColor: SHOP }}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
      {/* The number is text, not a colour cue, and the label above repeats it. */}
      <span
        className="absolute -right-1 -top-1 grid min-w-[17px] place-items-center rounded-full border border-paper px-1 text-[10px] font-bold leading-[15px] text-white"
        style={{ background: SHOP }}
      >
        {count > 9 ? "9+" : count}
      </span>
    </Link>
  );
}
