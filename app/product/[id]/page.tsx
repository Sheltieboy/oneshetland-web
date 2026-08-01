import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProduct, gbp } from "@/lib/shop-data";
import { AddToBasket } from "@/components/shop/AddToBasket";
import { SafeImage } from "@/components/ui/SafeImage";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await getProduct(id);
  if (!data) return { title: "Product" };
  return {
    title: `${data.product.title} · ${data.business?.name ?? "Shop"}`,
    openGraph: data.product.photos[0] ? { images: [data.product.photos[0]] } : undefined,
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getProduct(id);
  if (!data || !data.product.is_active) notFound();
  const { product, variants, shipping, business } = data;

  const fulfilmentLines: string[] = [];
  if (shipping?.collect_enabled ?? true) fulfilmentLines.push(`Collect from ${business?.name ?? "the shop"} — free${shipping?.collect_note ? ` (${shipping.collect_note})` : ""}`);
  if (!product.collect_only && shipping?.post_enabled) {
    fulfilmentLines.push(
      product.free_uk_post ? "Free UK postage" :
      shipping.post_uk_pence != null ? `UK postage from ${gbp(shipping.post_shetland_pence ?? shipping.post_uk_pence)}${shipping.free_over_pence ? ` · free over ${gbp(shipping.free_over_pence)}` : ""}` : "Posts orders",
    );
  }
  if (product.collect_only) fulfilmentLines.push("Collect only — too precious to post");

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      {business && (
        <Link href={`/directory/${business.slug || business.id}`} className="text-sm font-semibold text-ink-soft hover:text-ink">
          ← {business.name}
        </Link>
      )}
      <div className="mt-4 grid gap-8 md:grid-cols-2">
        {/* Photos */}
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {product.photos[0] ? (
            <SafeImage src={product.photos[0]} className="aspect-square w-full rounded-card border border-line object-cover" fallback={<span />} />
          ) : (
            <div className="grid aspect-square w-full place-items-center rounded-card border border-line bg-cream text-5xl">🛍️</div>
          )}
          {product.photos.length > 1 && (
            <div className="mt-2 flex gap-2 overflow-x-auto">
              {product.photos.slice(1).map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <SafeImage key={p} src={p} className="h-20 w-20 shrink-0 rounded-xl border border-line object-cover" fallback={<span />} />
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">{product.title}</h1>
          <p className="mt-2 font-display text-2xl font-bold" style={{ color: "#4f46e5" }}>
            {gbp(product.price_pence)}
            {product.compare_at_pence && <span className="ml-2 text-base font-normal text-ink-faint line-through">{gbp(product.compare_at_pence)}</span>}
          </p>
          {product.description && <p className="mt-4 whitespace-pre-line leading-relaxed text-ink-soft">{product.description}</p>}

          <div className="mt-6">
            <AddToBasket product={product} variants={variants} businessName={business?.name ?? "this shop"} />
          </div>

          {fulfilmentLines.length > 0 && (
            <ul className="mt-6 space-y-1 rounded-card border border-line bg-white p-4 text-sm text-ink-soft">
              {fulfilmentLines.map((l) => <li key={l}>· {l}</li>)}
            </ul>
          )}
          <p className="mt-3 text-xs text-ink-muted">Sold by {business?.name ?? "a Shetland business"} · payment held safely by Stripe · sold under the business&rsquo;s own terms.</p>
        </div>
      </div>
    </div>
  );
}
