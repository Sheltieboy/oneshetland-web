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
