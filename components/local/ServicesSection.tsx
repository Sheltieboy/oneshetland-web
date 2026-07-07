"use client";

import { useState } from "react";
import { money, type Service } from "@/lib/local-data";
import { GiftModal } from "./GiftModal";
import { BookServiceModal } from "./BookServiceModal";

export function ServicesSection({
  services,
  businessId,
  accent,
  isLoggedIn,
  signInHref,
  userId,
}: {
  services: Service[];
  businessId: string;
  accent: string;
  isLoggedIn: boolean;
  signInHref: string;
  userId: string | null;
}) {
  const [gift, setGift] = useState<Service | null>(null);
  const [book, setBook] = useState<Service | null>(null);

  if (services.length === 0) return null;

  return (
    <section>
      <h2 className="font-display text-2xl font-bold">Book online</h2>
      <div className="mt-5 divide-y divide-line rounded-xl border border-line bg-paper shadow-soft">
        {services.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <h3 className="font-semibold text-ink">{s.name}</h3>
              <p className="text-sm text-ink-muted">
                {s.duration_minutes} min{s.description ? ` · ${s.description}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="font-display text-lg font-bold" style={{ color: accent }}>{money(s.price_pence)}</span>
              <button
                onClick={() => setGift(s)}
                className="rounded-pill border border-line-strong px-3 py-1.5 text-sm font-semibold text-ink transition hover:bg-sand"
              >
                Gift
              </button>
              <button
                onClick={() => setBook(s)}
                className="rounded-pill px-4 py-1.5 text-sm font-semibold text-paper transition hover:brightness-95"
                style={{ background: accent }}
              >
                Book
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-ink-muted">No payment is taken online — settle at the venue. You can also gift a service.</p>

      {gift && (
        <GiftModal
          open={!!gift}
          onClose={() => setGift(null)}
          target={{ kind: "booking", id: gift.id, name: gift.name, pricePence: gift.price_pence }}
          accent={accent}
          isLoggedIn={isLoggedIn}
          signInHref={signInHref}
        />
      )}
      {book && (
        <BookServiceModal
          open={!!book}
          onClose={() => setBook(null)}
          service={book}
          businessId={businessId}
          accent={accent}
          isLoggedIn={isLoggedIn}
          signInHref={signInHref}
          userId={userId}
        />
      )}
    </section>
  );
}
