import type { MetadataRoute } from "next";

const BASE = "https://oneshetland.com";

/**
 * Tells crawlers what to index. Public content is open; private/account/API and
 * auth flows are kept out of the index. Points Google at the sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/account/",
        "/admin/",
        "/api/",
        "/sign-in",
        "/sign-up",
        "/forgot-password",
        "/reset-password",
        "/notifications",
        "/g/", // one-time gift claim links
        "/proposal", // unlisted partnership proposal — private, not for search
        "/proposal.html",
        "/merk-points", // unlisted concept note — private, not for search
        "/merk-points.html",
      ],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
