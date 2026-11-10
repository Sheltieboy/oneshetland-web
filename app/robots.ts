import type { MetadataRoute } from "next";
import { isDemoMode } from "@/lib/editions/demo-mode";

const BASE = "https://oneshetland.com";

/**
 * Tells crawlers what to index. Public content is open; private/account/API and
 * auth flows are kept out of the index. Points Google at the sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  if (isDemoMode()) return { rules: { userAgent: "*", disallow: "/" } }; // a demonstration deployment is never indexed
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/account/",
        "/admin/",
        "/organise/", // Edition organiser dashboard — private
        "/api/",
        "/sign-in",
        "/sign-up",
        "/forgot-password",
        "/reset-password",
        "/notifications",
        "/g/", // one-time gift claim links
        "/launch/", // private launch-partner previews — invitation only
        "/launch-testing", // private acceptance-testing area for invited testers (also noindex; the real protection is the database)
        "/proposal", // unlisted partnership proposal — private, not for search
        "/proposal.html",
        "/merk-points", // unlisted concept note — private, not for search
        "/merk-points.html",
      ],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
