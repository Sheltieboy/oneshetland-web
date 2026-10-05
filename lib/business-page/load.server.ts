/**
 * Business Page V2 — gather a business's real facts for a page model. SERVER-ONLY. Reads only what the public
 * listing already reads (the public view, public extras, active products, upcoming events); writes nothing.
 */
import { CATEGORY_LABEL, getBusiness, getBusinessEventsAndJobs, getBusinessExtras } from "@/lib/local-data";
import { getShopProducts } from "@/lib/shop-data";
import { buildBusinessPageModel } from "./model";
import type { BusinessPageModel, PageDraft } from "./types";

export async function loadBusinessPageModel(a: {
  businessId: string; mode: "draft" | "live"; draft: PageDraft | null; fallback: { name: string; locality?: string | null; description?: string | null };
}): Promise<BusinessPageModel> {
  const [business, extras, ev, products] = await Promise.all([
    getBusiness(a.businessId), getBusinessExtras(a.businessId), getBusinessEventsAndJobs(a.businessId), getShopProducts(a.businessId),
  ]);
  return buildBusinessPageModel({
    mode: a.mode,
    business: business ? {
      id: business.id, name: business.name, category: business.category, description: business.description, address: business.address,
      lat: business.lat ?? null, lng: business.lng ?? null, logo_url: business.logo_url ?? null, cover_url: business.cover_url ?? null, brand_color: business.brand_color ?? null,
      phone: business.phone ?? null, website: business.website ?? null, email: business.email ?? null, opening_hours: business.opening_hours ?? null,
      opening_hours_until: business.opening_hours_until ?? null, is_verified: !!business.is_verified, is_claimed: !!business.is_claimed, accepts_bookings: !!business.accepts_bookings,
    } : null,
    fallback: { id: a.businessId, ...a.fallback },
    categoryLabels: CATEGORY_LABEL,
    products: products.map((p) => ({ id: p.id, title: p.title, price_pence: p.price_pence, photos: p.photos })),
    offers: extras.offers.map((o) => ({ id: o.id, title: o.title, description: o.description ?? null, image_url: (o as { image_url?: string | null }).image_url ?? null })),
    services: extras.services.map((s) => ({ id: s.id, name: s.name, description: s.description ?? null, duration_minutes: s.duration_minutes ?? null, price_pence: s.price_pence ?? null })),
    loyalty: extras.loyalty ? { type: extras.loyalty.type, stamps_required: extras.loyalty.stamps_required ?? null, stamp_reward: extras.loyalty.stamp_reward ?? null, points_per_pound: extras.loyalty.points_per_pound ?? null, points_for_pound: extras.loyalty.points_for_pound ?? null } : null,
    events: ev.events.map((e) => ({ id: e.id, title: e.title, starts_at: e.starts_at, venue: e.venue ?? null })),
    draft: a.draft,
  });
}
