import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** The social-card renderer reads brand TTFs off disk at runtime — make sure
   *  serverless bundling (Netlify) traces them in. */
  outputFileTracingIncludes: {
    "/api/social-image": ["./assets/social-fonts/*.ttf"],
  },
  /**
   * Security headers (M1). Netlify already sends HSTS and nosniff; these are the
   * ones that were missing, plus nosniff restated so the set lives in one place
   * rather than half here and half in the platform.
   *
   * CSP is REPORT-ONLY on purpose. This app loads Stripe, Google Maps, Supabase
   * and Next's own inline bootstrap, and an enforcing policy written blind is
   * how a checkout silently stops working. Report-only publishes the same rules
   * and reports violations without blocking, so the real violation set can be
   * read off production before anything is enforced. Promoting it to
   * Content-Security-Policy is a one-word change once that has been reviewed.
   *
   * frame-ancestors is the modern control and is inside the CSP, but because
   * that CSP is report-only it would not actually block framing — so
   * X-Frame-Options carries clickjacking protection for real, today.
   */
  async headers() {
    const csp = [
      "default-src 'self'",
      // Next injects inline bootstrap and Stripe/Maps load their own SDKs.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://maps.googleapis.com https://*.supabase.co",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      // Supabase storage serves signed media; Maps serves tiles.
      "img-src 'self' data: blob: https://*.supabase.co https://*.googleapis.com https://*.gstatic.com https://*.ggpht.com",
      "media-src 'self' blob: https://*.supabase.co",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://maps.googleapis.com",
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; ');

    return [{
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy-Report-Only", value: csp },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        // The app records Spik audio and uses location for the memories map, so
        // those stay available to this origin; everything else is switched off.
        { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self), payment=(self), usb=(), magnetometer=(), accelerometer=()" },
      ],
    }];
  },

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
      { source: "/merk-points", destination: "/merk-points.html" },
    ];
  },
};

export default nextConfig;
