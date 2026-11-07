"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { SUPPORT_EMAIL, SUPPORT_PATH, ticketBuyersMailto } from "@/lib/contributor-copy";
import { MSG } from "@/lib/event-submissions-client";
import { focusRing } from "@/components/events/submit-ui";

/**
 * Shown INSTEAD of a generic error when the database refuses a cancellation because people have bought OneShetland tickets
 * (hint has_ticket_buyers). Calm, not an error: nothing is wrong, this one needs a person at OneShetland. Takes focus when it appears.
 */
export function TicketBuyersPanel({ title, onClose }: { title: string; onClose: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  return (
    <section aria-labelledby="tb-h" className="mt-4 rounded-2xl border-2 border-navy bg-cream p-5">
      <h2 id="tb-h" ref={heading} tabIndex={-1} className="text-xl font-bold text-ink outline-none">This one needs our help</h2>
      <p className="mt-2 text-base text-ink">{MSG.hasTicketBuyers}</p>
      <p className="mt-2 text-base text-ink">Nothing has been cancelled. The event is still on.</p>
      <p className="mt-4 flex flex-wrap items-center gap-4">
        <a href={ticketBuyersMailto(title)} className={`inline-flex min-h-12 items-center rounded-pill bg-navy px-6 py-3 text-lg font-bold text-white ${focusRing}`}>Email {SUPPORT_EMAIL}</a>
        <Link href={SUPPORT_PATH} className={`inline-flex min-h-11 items-center text-base font-semibold text-navy underline ${focusRing}`}>Other ways to reach us</Link>
        <button type="button" onClick={onClose} className={`inline-flex min-h-11 items-center text-base font-semibold text-navy underline ${focusRing}`}>Close</button>
      </p>
    </section>
  );
}
