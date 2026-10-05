/**
 * invite.ts — the shape of a Launch Partner invitation, as far as the WEB cares.
 *
 * Whether a token is valid is decided in the DATABASE (launch_invite_resolve): only a SHA-256 of the token is stored,
 * it belongs to exactly one business, and it can be revoked, expire, and be tied to the first account that claims
 * through it. This module only knows what a well-formed token and slug look like, and where the web keeps the token.
 *
 * WHERE THE TOKEN LIVES. The link a business is sent carries ?invite=<token>. The first request (proxy.ts) moves it
 * into an HttpOnly cookie scoped to that one preview and redirects to the clean address, so the token is not left
 * in the address bar, history, a Referer header, analytics, or the `next=` parameter of the sign-in page. Everything
 * after — sign-in, sign-up, the claim form — reads the cookie on the server. The browser's JavaScript never sees it.
 */

/** 64 hex characters from the database today; the format allows base64url so older or longer tokens also work. */
export const TOKEN_RE = /^[A-Za-z0-9_-]{40,128}$/;
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,60}$/;

export const isToken = (v: unknown): v is string => typeof v === "string" && TOKEN_RE.test(v);
export const isSlug = (v: unknown): v is string => typeof v === "string" && SLUG_RE.test(v);

export const inviteCookieName = (slug: string) => `lp_invite_${slug.replace(/-/g, "_")}`;
export const invitePath = (slug: string) => `/launch/${slug}`;
/** Long enough to come back to the preview for a couple of weeks; short enough not to linger on a shared computer. */
export const INVITE_COOKIE_MAX_AGE = 60 * 60 * 24 * 14;

export type ClaimState = "open" | "pending" | "rejected" | "owner" | "claimed_by_other" | "invite_used";
export interface InviteView { state: ClaimState; business_id: string; business_name: string }

export interface InviteHandoff {
  /** Where to redirect: the same path with the query string removed. */
  location: string;
  /** The cookie to set, or null when the slug or token is malformed (the query is still shed). */
  cookie: { name: string; value: string; path: string; maxAge: number; httpOnly: true; sameSite: "lax" } | null;
}

/**
 * proxy.ts calls this for every request. For /launch/{slug}?invite=… it says "set this cookie and redirect to the
 * clean address"; for anything else it returns null and the request carries on untouched.
 */
export function inviteHandoff(pathname: string, search: URLSearchParams): InviteHandoff | null {
  const m = /^\/launch\/([^/]+)\/?$/.exec(pathname);
  if (!m || !search.has("invite")) return null;
  const slug = m[1];
  const token = search.get("invite");
  return {
    location: pathname,
    cookie: isSlug(slug) && isToken(token)
      ? { name: inviteCookieName(slug), value: token, path: invitePath(slug), maxAge: INVITE_COOKIE_MAX_AGE, httpOnly: true, sameSite: "lax" }
      : null,
  };
}
