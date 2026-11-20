/**
 * preview-link.ts — the shape of a private Edition preview, as far as the WEB cares.
 *
 * Whether a token is valid is decided in the DATABASE (`edition_preview_id()`, migration
 * 20270311000000): the token belongs to exactly one Edition, it can be revoked, it expires, and it
 * grants `select` and nothing else. This module only knows what a well-formed token and slug look
 * like, and where the web keeps the token.
 *
 * WHERE THE TOKEN LIVES. The link an organiser is sent carries `?preview=<token>`. The first request
 * (proxy.ts) moves it into an HttpOnly cookie scoped to that one Edition and redirects to the clean
 * address, so the token is not left in the address bar, in history, in a Referer header, in analytics,
 * or in the `next=` parameter of the sign-in page. Every page of the Edition after that — and every
 * photograph on it — reads the cookie on the server. The browser's JavaScript never sees it.
 *
 * This mirrors the Launch Partner invitation handoff in lib/launch-preview/invite.ts, deliberately:
 * it is the same problem, already solved and already in production.
 */

/** 43 base64url characters from the database today; the range allows a longer token later. */
export const PREVIEW_TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;
export const EDITION_SLUG_RE = /^[a-z0-9][a-z0-9-]{2,80}$/;

export const isPreviewToken = (v: unknown): v is string => typeof v === "string" && PREVIEW_TOKEN_RE.test(v);
export const isEditionSlug = (v: unknown): v is string => typeof v === "string" && EDITION_SLUG_RE.test(v);

/** One cookie per Edition, so holding two previews never confuses them and revoking one leaves the other. */
export const previewCookieName = (slug: string) => `ed_preview_${slug.replace(/-/g, "_")}`;
export const editionBasePath = (slug: string) => `/editions/${slug}`;

/**
 * Long enough to read the Edition over a few days without the link being re-sent; short enough not to
 * linger on a shared computer. The DATABASE expiry is the real limit — this only decides how long the
 * browser bothers to remember, and a cookie that outlives its token simply stops working.
 */
export const PREVIEW_COOKIE_MAX_AGE = 60 * 60 * 24 * 14;

/** The query parameter on the link that is emailed out. */
export const PREVIEW_QUERY = "preview";
/** The request header the database reads. Must match `edition_preview_token()`. */
export const PREVIEW_HEADER = "x-edition-preview";

export interface PreviewHandoff {
  /** Where to redirect: the same path with the query string removed. */
  location: string;
  /** The cookie to set, or null when the slug or token is malformed (the query is still shed). */
  cookie: { name: string; value: string; path: string; maxAge: number; httpOnly: true; sameSite: "lax" } | null;
}

/**
 * proxy.ts calls this for every request. For `/editions/{slug}?preview=…` — including a deeper page
 * such as `/editions/{slug}/markets?preview=…` — it says "set this cookie and redirect to the clean
 * address"; for anything else it returns null and the request carries on untouched.
 *
 * The cookie is scoped to the Edition's base path, so it is sent for every page, programme item and
 * route beneath it, and for nothing else on OneShetland.
 */
export function previewHandoff(pathname: string, search: URLSearchParams): PreviewHandoff | null {
  const m = /^\/editions\/([^/]+)(?:\/.*)?$/.exec(pathname);
  if (!m || !search.has(PREVIEW_QUERY)) return null;
  const slug = m[1];
  const token = search.get(PREVIEW_QUERY);
  return {
    location: pathname,
    cookie: isEditionSlug(slug) && isPreviewToken(token)
      ? { name: previewCookieName(slug), value: token, path: editionBasePath(slug), maxAge: PREVIEW_COOKIE_MAX_AGE, httpOnly: true, sameSite: "lax" }
      : null,
  };
}

/** The link to send. Absolute, because it is pasted into an email. */
export const previewUrl = (origin: string, slug: string, token: string) =>
  `${origin.replace(/\/$/, "")}${editionBasePath(slug)}?${PREVIEW_QUERY}=${encodeURIComponent(token)}`;
