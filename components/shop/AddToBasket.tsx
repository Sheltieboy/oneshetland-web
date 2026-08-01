"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addToBasket, type BasketLine } from "@/lib/basket";
import { availableQty, gbp, type Product, type ProductVariant } from "@/lib/shop-data";
import { useConfirm } from "@/components/ui/ConfirmProvider";

const SHOP = "#4f46e5";

export function AddToBasket({ product, variants, businessName }: {
  product: Product;
  variants: ProductVariant[];
  businessName: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [variantId, setVariantId] = useState<string | null>(variants[0]?.id ?? null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const variant = variants.find((v) => v.id === variantId) ?? null;
  const avail = availableQty(product, variant);
  const unit = product.price_pence + (variant?.price_delta_pence ?? 0);

  async function add() {
    const line: BasketLine = {
      product_id: product.id,
      variant_id: variant?.id ?? null,
      title: product.title,
      variant_name: variant?.name ?? null,
      unit_pence: unit,
      qty,
      photo_url: product.photos[0] ?? null,
      collect_only: product.collect_only,
      free_uk_post: product.free_uk_post,
    };
    let res = addToBasket(product.business_id, businessName, line);
    if (res === "other_shop") {
      const ok = await confirm({
        title: "Start a new basket?",
        body: `Your basket has items from another shop — checkout is one shop at a time. Swap to ${businessName}?`,
        confirmLabel: "Start new basket",
      });
      if (!ok) return;
      res = addToBasket(product.business_id, businessName, line, { replace: true });
    }
    if (res === "added") { setAdded(true); setTimeout(() => setAdded(false), 2500); }
  }

  if (avail === 0) {
    return <p className="rounded-xl bg-sand px-4 py-3 text-sm font-bold text-ink-soft">Sold out{product.stock_mode === "one_off" ? " — it was a one-off" : ""}</p>;
  }

  return (
    <div className="space-y-3">
      {variants.length > 0 && (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Options">
          {variants.map((v) => {
            const on = v.id === variantId;
            const vAvail = availableQty(product, v);
            return (
              <button key={v.id} role="radio" aria-checked={on} disabled={vAvail === 0}
                onClick={() => { setVariantId(v.id); setQty(1); }}
                className={"rounded-pill px-4 py-1.5 text-sm font-bold transition disabled:line-through disabled:opacity-40 " + (on ? "text-white" : "border border-line text-ink-soft hover:bg-sand")}
                style={on ? { background: SHOP } : undefined}>
                {v.name}{v.price_delta_pence ? ` +${gbp(v.price_delta_pence)}` : ""}
              </button>
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-pill border border-line">
          <button onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Fewer" className="px-3 py-2 font-bold text-ink-soft">−</button>
          <span className="min-w-6 text-center text-sm font-bold">{qty}</span>
          <button onClick={() => setQty(Math.min(avail, qty + 1))} aria-label="More" className="px-3 py-2 font-bold text-ink-soft">＋</button>
        </div>
        <button onClick={add}
          className="flex-1 rounded-pill px-6 py-3 text-sm font-bold text-white transition hover:opacity-90 sm:flex-none"
          style={{ background: added ? "#059669" : SHOP }}>
          {added ? "✓ In your basket" : `Add to basket · ${gbp(unit * qty)}`}
        </button>
        {added && (
          <button onClick={() => router.push("/basket")} className="rounded-pill border border-line px-5 py-3 text-sm font-bold text-ink-soft hover:bg-sand">
            Go to basket →
          </button>
        )}
      </div>
      {product.stock_mode === "made_to_order" && (
        <p className="text-sm text-ink-muted">Made to order — allow about {product.lead_time_days ?? 14} days.</p>
      )}
      {product.stock_mode === "tracked" && avail <= 3 && avail < 99 && (
        <p className="text-sm font-semibold text-amber-700">Only {avail} left.</p>
      )}
    </div>
  );
}
