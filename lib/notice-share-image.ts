/**
 * Category artwork for a notice's link preview (Open Graph / Twitter). Facebook builds the card for a shared notice link from the
 * notice page's og:image, so the card shows the right branded image AND clicking it opens the notice itself.
 * MUST match NOTICE_CATEGORY_IMAGE in the backend's supabase/functions/_shared/social-recipes.ts (a backend test compares them).
 */
export const NOTICE_SHARE_IMAGE: Readonly<Record<string, string>> = {
  travel_transport: "travel",
  health: "health",
  public_services: "council",
  consultations_funding: "consultations",
  community: "community",
};
export const NOTICE_SHARE_FALLBACK = "community";

export function noticeShareImage(categoryId: string | null | undefined): string {
  const key = NOTICE_SHARE_IMAGE[String(categoryId ?? "").trim().toLowerCase()] ?? NOTICE_SHARE_FALLBACK;
  return `/social/notices/notice-${key}.jpg`;
}

const clip = (s: string, n: number) => { const t = s.replace(/\s+/g, " ").trim(); return t.length <= n ? t : t.slice(0, n - 1).replace(/\s+\S*$/, "") + "…"; };

/** Metadata for one PUBLIC notice. Overrides the site-wide og:url / canonical (which point at the home page) so Facebook keeps the notice URL. */
export function noticeMetadata(n: { id: string; title: string; body: string; categoryId?: string | null }) {
  const url = `/notices/${n.id}`;
  const image = { url: noticeShareImage(n.categoryId), width: 1200, height: 630, alt: "OneShetland notice" };
  const title = clip(n.title, 90);
  const description = clip(n.body || "A public notice on OneShetland.", 200);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "article" as const, siteName: "OneShetland", locale: "en_GB", url, title, description, images: [image] },
    twitter: { card: "summary_large_image" as const, title, description, images: [image.url] },
  };
}
