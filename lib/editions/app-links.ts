/** Universal-link paths the iOS app claims (served by /.well-known/apple-app-site-association).
 * Exclusions first: Apple applies the first path entry that matches. */
export const APP_LINK_PATHS = [
  "NOT /organisers/*/membership",
  "NOT /editions/*/calendar.ics",
  "NOT /editions/*/programme/*/calendar.ics",
  "/t/*", "/g/*", "/give/*",
  "/editions", "/editions/*", "/organisers/*",
];
