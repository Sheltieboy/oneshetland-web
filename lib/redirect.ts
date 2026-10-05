/**
 * Open-redirect guard for `?next=` return-to-after-sign-in params.
 *
 * Returns `next` only if it is a safe internal absolute path:
 *   - must start with a single "/"
 *   - must NOT start with "//" or "/\" (protocol-relative / backslash tricks)
 *   - must NOT contain a scheme (e.g. "http:", "javascript:")
 * Otherwise falls back to "/account".
 */
export function safeNext(next: string | null | undefined): string {
  const fallback = "/account";
  if (!next) return fallback;
  // Must be an absolute internal path.
  if (!next.startsWith("/")) return fallback;
  // Reject protocol-relative ("//host") and backslash ("/\host") forms.
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  // Reject anything carrying a scheme (e.g. "/x:http://evil" can't, but be safe).
  if (/^[a-z][a-z0-9+.-]*:/i.test(next)) return fallback;
  return next;
}

/**
 * Where a signed-out owner should land after signing in, for any /business/{id}/manage/* page.
 *
 * `returnPath` is the page that was actually asked for. It is honoured only if it is a safe internal path AND it
 * stays inside this business's own manage area, so a crafted value can neither leave the site nor wander into
 * another business. Anything else falls back to the manage dashboard — which is where every page used to send you.
 */
export function manageReturnPath(idOrSlug: string, returnPath?: string | null): string {
  const root = `/business/${idOrSlug}/manage`;
  if (!returnPath) return root;
  if (!returnPath.startsWith("/")) return root;
  const safe = safeNext(returnPath);
  if (safe === "/account" && returnPath !== "/account") return root;   // safeNext refused it
  if (safe === root || safe.startsWith(`${root}/`) || safe.startsWith(`${root}?`)) return safe;
  return root;
}

/** The sign-in URL for a manage page. The destination is encoded so a query string survives the round trip. */
export function manageSignInUrl(idOrSlug: string, returnPath?: string | null): string {
  return `/sign-in?next=${encodeURIComponent(manageReturnPath(idOrSlug, returnPath))}`;
}
