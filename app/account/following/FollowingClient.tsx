"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CATEGORY_LABEL } from "@/lib/local-data";
import { fetchFollowedBusinesses, type FollowedBusiness } from "@/lib/follows-data";

const LOCAL = "#7c3aed";

function accentOf(brand: string | null) {
  if (brand && /^#?[0-9a-f]{6}$/i.test(brand)) return brand.startsWith("#") ? brand : `#${brand}`;
  return LOCAL;
}

function BusinessRow({ b }: { b: FollowedBusiness }) {
  const accent = accentOf(b.brand_color);
  return (
    <li>
      <Link
        href={`/directory/${b.slug ?? b.id}`}
        className="flex items-center gap-3 rounded-card border border-line bg-paper p-4 shadow-soft transition hover:border-current"
        style={{ color: accent }}
      >
        {b.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.logo_url} alt="" className="h-12 w-12 shrink-0 rounded-card object-cover" />
        ) : (
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-card text-lg font-bold text-paper" style={{ background: accent }}>
            {b.name.slice(0, 1)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-semibold text-ink">{b.name}</span>
            {b.is_verified && <span aria-label="Verified" style={{ color: accent }}>✓</span>}
          </div>
          {b.category && (
            <p className="text-sm text-ink-muted">{CATEGORY_LABEL[b.category] ?? b.category}</p>
          )}
        </div>
        <span aria-hidden className="text-ink-muted">›</span>
      </Link>
    </li>
  );
}

export function FollowingClient() {
  const [items, setItems] = useState<FollowedBusiness[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setItems(await fetchFollowedBusinesses());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load the businesses you follow.");
        setItems([]);
      }
    })();
  }, []);

  if (error) {
    return <p className="rounded-card border border-line bg-paper px-4 py-3 text-sm text-rose-600">{error}</p>;
  }

  if (items === null) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-card border border-line bg-sand" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-card border border-line bg-paper p-10 text-center shadow-soft">
        <p className="font-display font-bold text-ink">Not following anyone yet</p>
        <p className="mt-1 text-sm text-ink-muted">
          Follow Shetland businesses to keep their offers, events and loyalty close to hand.
        </p>
        <Link
          href="/directory"
          className="mt-5 inline-block rounded-pill px-5 py-2.5 text-sm font-semibold text-paper"
          style={{ background: LOCAL }}
        >
          Browse the directory
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((b) => (
        <BusinessRow key={b.id} b={b} />
      ))}
    </ul>
  );
}
