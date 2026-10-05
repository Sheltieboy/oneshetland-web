/**
 * invite.ts — private access for a Launch Partner Preview.
 *
 * An invitation is a high-entropy random token in the link (?invite=…). The server never stores the token: it stores
 * the SHA-256 of it, in the LAUNCH_PREVIEW_INVITES environment variable, keyed by preview slug:
 *
 *   LAUNCH_PREVIEW_INVITES='{"love-from-shetland":["<sha256 hex>", "<sha256 hex>@2026-12-31"]}'
 *
 *   · the token is not in source control, in the database, or in any log — only its hash is, and only in deployment config
 *   · each slug has its OWN list, so one business's invitation opens nothing else
 *   · REVOKE by deleting the hash and redeploying; an entry can also carry an @YYYY-MM-DD expiry
 *   · several hashes per slug are allowed, so a new link can be issued before the old one is revoked
 *
 * Comparison is constant-time and always runs, so neither a wrong token nor an unknown slug is distinguishable from the
 * other by response or timing.
 */
import { createHash, timingSafeEqual } from 'node:crypto';

export type InviteTable = Record<string, string[]>;

/** 32 random bytes as base64url is 43 characters; anything much shorter is not one of ours. */
const TOKEN_RE = /^[A-Za-z0-9_-]{40,128}$/;
const HASH_RE = /^[0-9a-f]{64}$/;

export const hashToken = (token: string): string => createHash('sha256').update(token, 'utf8').digest('hex');

export function parseInviteTable(raw: string | undefined | null): InviteTable {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    const out: InviteTable = {};
    for (const [slug, list] of Object.entries(v as Record<string, unknown>)) {
      if (Array.isArray(list)) out[slug] = list.filter((x): x is string => typeof x === 'string');
    }
    return out;
  } catch {
    return {};          // a malformed variable means "no invitations", never "open"
  }
}

/** Does `token` open the preview for `slug`? Fails closed on anything unexpected. */
export function verifyInvite(table: InviteTable, slug: string, token: unknown, now: Date = new Date()): boolean {
  const candidate = typeof token === 'string' && TOKEN_RE.test(token) ? token : '';
  const digest = Buffer.from(hashToken(candidate || 'no-token'), 'hex');
  let ok = false;
  for (const entry of table[slug] ?? []) {
    const [hash, expires] = entry.split('@');
    if (!HASH_RE.test(hash ?? '')) continue;
    if (expires) {
      const end = new Date(`${expires}T23:59:59Z`);
      if (Number.isNaN(end.getTime()) || end < now) continue;
    }
    // Compare every entry in full; do not stop at the first match.
    if (timingSafeEqual(digest, Buffer.from(hash, 'hex')) && candidate) ok = true;
  }
  return ok;
}

export const inviteTableFromEnv = (): InviteTable => parseInviteTable(process.env.LAUNCH_PREVIEW_INVITES);
