"use client";

/**
 * basket.ts — the Shop Shetland basket. One business per basket (checkout is
 * per-business by design); adding from a different shop offers to start fresh.
 * localStorage-backed with a tiny subscribe API so the header pill stays live.
 */

export type BasketLine = {
  product_id: string;
  variant_id: string | null;
  title: string;
  variant_name: string | null;
  unit_pence: number;
  qty: number;
  photo_url: string | null;
  collect_only: boolean;
  free_uk_post: boolean;
};

export type Basket = {
  business_id: string;
  business_name: string;
  lines: BasketLine[];
};

const KEY = "os_basket_v1";
const listeners = new Set<() => void>();

export function getBasket(): Basket | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const b = JSON.parse(raw) as Basket;
    return Array.isArray(b.lines) && b.lines.length ? b : null;
  } catch { return null; }
}

function write(b: Basket | null) {
  if (b && b.lines.length) localStorage.setItem(KEY, JSON.stringify(b));
  else localStorage.removeItem(KEY);
  listeners.forEach((fn) => fn());
}

export function subscribeBasket(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function basketCount(): number {
  return getBasket()?.lines.reduce((s, l) => s + l.qty, 0) ?? 0;
}

export function basketItemsPence(b: Basket | null = getBasket()): number {
  return b?.lines.reduce((s, l) => s + l.unit_pence * l.qty, 0) ?? 0;
}

/** Add a line. Returns 'other_shop' if the basket holds a different business. */
export function addToBasket(businessId: string, businessName: string, line: BasketLine, opts?: { replace?: boolean }): "added" | "other_shop" {
  let b = getBasket();
  if (b && b.business_id !== businessId) {
    if (!opts?.replace) return "other_shop";
    b = null;
  }
  if (!b) b = { business_id: businessId, business_name: businessName, lines: [] };
  const key = (l: BasketLine) => `${l.product_id}:${l.variant_id ?? ""}`;
  const existing = b.lines.find((l) => key(l) === key(line));
  if (existing) existing.qty = Math.min(99, existing.qty + line.qty);
  else b.lines.push(line);
  write(b);
  return "added";
}

export function setLineQty(productId: string, variantId: string | null, qty: number) {
  const b = getBasket();
  if (!b) return;
  const line = b.lines.find((l) => l.product_id === productId && l.variant_id === variantId);
  if (!line) return;
  line.qty = qty;
  b.lines = b.lines.filter((l) => l.qty > 0);
  write(b);
}

export function clearBasket() { write(null); }
