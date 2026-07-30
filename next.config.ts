import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * 301/308 redirects from the old WordPress URL structure to the new app, so
   * the ranking equity Google built up on the old site is passed through instead
   * of hitting 404s. (Spam URLs from the old site's hack — /items, /goodscode,
   * /shopbrand etc. — are deliberately NOT redirected; they correctly 404 so
   * Google drops them.) The /spik_word/<word> case needs a DB lookup, handled by
   * app/spik_word/[word]/page.tsx.
   */
  async redirects() {
    return [
      { source: "/shetland-services", destination: "/directory", permanent: true },
      { source: "/shetland-services/:slug", destination: "/directory/:slug", permanent: true },
      { source: "/events/:path*", destination: "/whats-on", permanent: true },
      { source: "/series/:path*", destination: "/whats-on", permanent: true },
      { source: "/venue/:path*", destination: "/whats-on", permanent: true },
      { source: "/organiser/:path*", destination: "/whats-on", permanent: true },
      { source: "/cruise_visit/:path*", destination: "/cruise", permanent: true },
      { source: "/noticeboard/:path*", destination: "/local", permanent: true },
      { source: "/find-candidates/:path*", destination: "/jobs", permanent: true },
      { source: "/spik_word", destination: "/spik", permanent: true },
      { source: "/about", destination: "/", permanent: true },
    ];
  },
  /** Clean URL for the (unlisted, noindex) partnership proposal one-pager. */
  async rewrites() {
    return [
      { source: "/proposal", destination: "/proposal.html" },
      { source: "/shetland-points", destination: "/shetland-points.html" },
    ];
  },
};

export default nextConfig;
