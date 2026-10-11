/**
 * access.ts — who may see the Test Centre. The decision is made from facts the database has already established (the session, the admin
 * role, the tester row that row-level security only returns to its owner), never from the address a person typed.
 *
 *   sign_in     not signed in → the normal OneShetland sign-in
 *   tester      an enabled tester of an open programme
 *   admin_only  an administrator who is not a tester → pointed to the admin dashboard
 *   not_found   everyone else → the ordinary "page not found", revealing nothing
 */
export type LaunchAccess = "sign_in" | "tester" | "admin_only" | "not_found";

export function launchAccessFor(f: { signedIn: boolean; isAdmin: boolean; isEnabledTester: boolean }): LaunchAccess {
  if (!f.signedIn) return "sign_in";
  if (f.isEnabledTester) return "tester";
  if (f.isAdmin) return "admin_only";
  return "not_found";
}
