/**
 * invites.ts — the shape of an assisted-publishing invitation, as far as the WEB cares.
 *
 * Whether a token is valid is decided in the DATABASE: only a SHA-256 of it is stored, it belongs to
 * exactly one record, and it can be revoked, superseded, expire, be declined, and be tied to the
 * first account that claims through it. This module only knows what a well-formed token and slug look
 * like, where the web keeps the token, and the words used for each state.
 *
 * WHERE THE TOKEN LIVES. The link we send carries ?invite=<token>. The first request (proxy.ts) moves
 * it into an HttpOnly cookie scoped to that one invitation and redirects to the clean address, so the
 * token never reaches the address bar, the browser history, a Referer header, analytics, or the
 * `next=` parameter of the sign-in page. Everything after it — reading the page, signing in, signing
 * up, sending the claim — reads the cookie on the server. The browser's JavaScript never sees it.
 *
 * This is deliberately the same mechanism as the Launch Partner invitation
 * (lib/launch-preview/invite.ts); only the path and the cookie prefix differ.
 */

import type { AssistedKind } from "./shape";

/** 64 hex characters from the database today; the format allows base64url so a longer token also works. */
export const TOKEN_RE = /^[A-Za-z0-9_-]{40,128}$/;
/** The database issues `c` + 20 hex characters. The pattern is kept broad enough for the general slug rule. */
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,60}$/;

export const isToken = (v: unknown): v is string => typeof v === "string" && TOKEN_RE.test(v);
export const isSlug = (v: unknown): v is string => typeof v === "string" && SLUG_RE.test(v);

export const claimCookieName = (slug: string) => `os_claim_${slug.replace(/-/g, "_")}`;
export const claimPath = (slug: string) => `/claim/${slug}`;
/** Long enough to come back and think about it; short enough not to linger on a shared computer. */
export const CLAIM_COOKIE_MAX_AGE = 60 * 60 * 24 * 14;

/** The address that goes in an email. Only ever built where the token is still in memory. */
export const claimUrl = (origin: string, slug: string, token: string) =>
  `${origin.replace(/\/+$/, "")}/claim/${slug}?invite=${token}`;

export type ClaimState = "open" | "pending" | "rejected" | "owner" | "claimed_by_other" | "invite_used";

export interface InviteSubject {
  kind: AssistedKind;
  name: string;
  slug: string | null;
  path: string;
  area: string | null;
  description: string | null;
  is_claimed: boolean;
  is_active: boolean;
  owned: boolean;
}
export interface InviteOpen {
  kind: AssistedKind;
  subject: InviteSubject;
  invited_name: string | null;
  expires_at: string;
  already_owned: boolean;
}
export interface InviteClaimView {
  state: ClaimState;
  kind: AssistedKind;
  subject_id: string;
  subject_name: string;
  subject_path: string;
}

/**
 * The invitation statuses, as the database's admin list reports them, in the order an invitation
 * normally moves through them. "link fetched" is named for what it is: a request for the address,
 * which may well have been an email security scanner rather than a person.
 */
export const INVITE_STATUSES = [
  "prepared", "sent", "link fetched", "claim requested", "approved", "rejected", "declined", "expired", "revoked",
] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];

export const INVITE_STATUS_MEANING: Record<InviteStatus, string> = {
  prepared: "Made, but nothing has been sent and nobody has been told.",
  sent: "Sent — by email from OneShetland, or by you, from your own email.",
  "link fetched": "The address has been requested. That may have been a person, or an email security scanner checking the link, so it is not proof anybody read it.",
  "claim requested": "Somebody signed in and asked to look after it. Waiting for you to decide.",
  approved: "You approved the claim, and they look after it now.",
  rejected: "You turned the claim down. The page is unchanged and we still look after it.",
  declined: "They said no thanks. The page is unchanged and we still look after it.",
  expired: "Nobody acted before it ran out. The page is unchanged and we still look after it.",
  revoked: "You cancelled it, or a newer invitation replaced it.",
};

/** What a recipient could do if they claimed it — used on the invitation page, so it is never vague. */
export function whatYouCouldManage(kind: AssistedKind): string[] {
  return kind === "hub"
    ? [
        "Change the description, contact details, area and photographs.",
        "Post events to the islands-wide What's On calendar.",
        "Put up notices for your community.",
        "Later, if you want it: a joining list, membership and fundraising.",
      ]
    : [
        "Change the description, address, opening details and photographs.",
        "Add offers and products.",
        "Post your events to the islands-wide What's On calendar.",
        "Later, if you want it: bookings and online selling.",
      ];
}

export interface ClaimHandoff {
  location: string;
  cookie: { name: string; value: string; path: string; maxAge: number; httpOnly: true; sameSite: "lax" } | null;
}

/**
 * proxy.ts calls this for every request. For /claim/{slug}?invite=… it says "set this cookie and
 * redirect to the clean address"; for anything else it returns null and the request carries on.
 */
export function claimHandoff(pathname: string, search: URLSearchParams): ClaimHandoff | null {
  const m = /^\/claim\/([^/]+)\/?$/.exec(pathname);
  if (!m || !search.has("invite")) return null;
  const slug = m[1];
  const token = search.get("invite");
  return {
    location: pathname,
    cookie: isSlug(slug) && isToken(token)
      ? { name: claimCookieName(slug), value: token, path: claimPath(slug), maxAge: CLAIM_COOKIE_MAX_AGE, httpOnly: true, sameSite: "lax" }
      : null,
  };
}
