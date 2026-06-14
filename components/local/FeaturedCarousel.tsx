/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CATEGORY_LABEL, type Business } from "@/lib/local-data";

const LOCAL = "#7c3aed";

function accentOf(b: Business) {
  const c = b.brand_color;
  if (c && /^#?[0-9a-f]{6}$/i.test(c)) return c.startsWith("#") ? c : `#${c}`;
  return LOCAL;
}

export function FeaturedCarousel({ businesses }: { businesses: Business[] }) {
  const items = businesses.slice(0, 5);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const t = setInterval(() => setI((x) => (x + 1) % items.length), 5500);
    return () => clearInterval(t);
  }, [items.length]);

  if (items.length === 0) return null;

  return (
    <div className="relative min-h-[340px] overflow-hidden rounded-xl shadow-soft sm:min-h-[400px]">
      {items.map((b, idx) => {
        const active = idx === i;
        const href = `/directory/${b.slug ?? b.id}`;
        const accent = accentOf(b);
        return (
          <div
            key={b.id}
            className={
              "absolute inset-0 transition-opacity duration-700 " +
              (active ? "opacity-100" : "pointer-events-none opacity-0")
            }
            style={{ background: accent }}
            aria-hidden={!active}
          >
            {b.cover_url ? (
              <img src={b.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/10" />
            <div className="relative flex min-h-[340px] flex-col justify-end p-7 text-paper sm:min-h-[400px] sm:p-10">
              <p className="eyebrow text-paper/85">Featured business</p>
              <h2 className="mt-2 font-display text-3xl font-bold drop-shadow sm:text-[2.5rem]">{b.name}</h2>
              <p className="mt-1 text-paper/85">{b.category ? (CATEGORY_LABEL[b.category] ?? b.category) : ""}</p>
              {b.description ? (
                <p className="mt-3 line-clamp-2 max-w-xl text-paper/85">{b.description}</p>
              ) : null}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href={href}
                  className="rounded-pill bg-paper px-6 py-3 font-semibold text-ink shadow-soft transition hover:bg-cream"
                >
                  View business
                </Link>
                {b.accepts_bookings && (
                  <span className="rounded-pill bg-paper/20 px-3 py-1.5 text-sm font-semibold backdrop-blur-sm">
                    Book online
                  </span>
                )}
                {b.accepts_wallet && b.cashback_percent > 0 && (
                  <span className="rounded-pill bg-paper/20 px-3 py-1.5 text-sm font-semibold backdrop-blur-sm">
                    {b.cashback_percent}% cashback
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Dots */}
      {items.length > 1 && (
        <div className="absolute bottom-5 right-6 z-10 flex gap-2">
          {items.map((_, idx) => (
            <button
              key={idx}
              type="button"
              aria-label={`Show featured ${idx + 1}`}
              onClick={() => setI(idx)}
              className={
                "h-2.5 rounded-pill transition-all " +
                (idx === i ? "w-6 bg-paper" : "w-2.5 bg-paper/50 hover:bg-paper/80")
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
