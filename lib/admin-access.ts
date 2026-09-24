/**
 * admin-access.ts — the one web definition of "is this a platform admin".
 *
 * Pure so it can be executed by tests under plain node. requireAdmin() and
 * isAdmin() in admin-data.server.ts are the only callers that act on it; do not
 * re-derive the rule anywhere else. profiles.role is locked against
 * self-service edits by tg_profiles_lock_sensitive, so it is safe to trust.
 */

export type AdminAccess = "allow" | "sign_in" | "deny";

export function adminAccessFor(
  account: { profile: { role?: string | null } | null } | null,
): AdminAccess {
  if (!account) return "sign_in";
  return account.profile?.role === "admin" ? "allow" : "deny";
}
