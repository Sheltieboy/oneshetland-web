/** Universal-link paths the iOS app claims (served by /.well-known/apple-app-site-association).
 *
 * Exclusions first: Apple applies the first path entry that matches, so a "NOT" has to sit above anything that would
 * otherwise catch the same URL.
 *
 * Every entry here must correspond to a screen that actually exists in the app. A path the app cannot render opens the
 * app and leaves the person on Home, having lost the page they tapped, which is worse than letting Safari handle it.
 * Note that `*` matches any characters INCLUDING `/`, so an entry without a star claims that one URL and none of its
 * children — which is how the House Swaps member area stays out (the app has no screens under /house-swaps, and
 * /house-swaps/moderate is staff-only and web-only).
 */
export const APP_LINK_PATHS = [
  "NOT /organisers/*/membership",
  "NOT /editions/*/calendar.ics",
  "NOT /editions/*/programme/*/calendar.ics",
  "/t/*", "/g/*", "/give/*",
  "/editions", "/editions/*", "/organisers/*",
  // app/house-swaps.tsx. Exact: the app has no child screens under it.
  "/house-swaps",
  // app/almanac.tsx and app/almanac/[slug].tsx
  "/almanac", "/almanac/*",
  // app/whats-on/regular.tsx and app/whats-on/regular/[slug].tsx
  "/whats-on/regular", "/whats-on/regular/*",
];
