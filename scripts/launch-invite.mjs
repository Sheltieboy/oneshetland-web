#!/usr/bin/env node
/**
 * Issue a Launch Partner Preview invitation.
 *
 *   node scripts/launch-invite.mjs <slug> [expiry YYYY-MM-DD]
 *
 * Prints, once, the private link token and the hash entry to add to LAUNCH_PREVIEW_INVITES. The token is NOT stored
 * anywhere by this script; keep it only in the message you send. To revoke, delete the hash entry and redeploy.
 */
import { randomBytes, createHash } from "node:crypto";

const [slug, expiry] = process.argv.slice(2);
if (!slug) { console.error("usage: node scripts/launch-invite.mjs <slug> [YYYY-MM-DD]"); process.exit(1); }
if (expiry && !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) { console.error("expiry must be YYYY-MM-DD"); process.exit(1); }
const token = randomBytes(32).toString("base64url");
const hash = createHash("sha256").update(token, "utf8").digest("hex");
console.log(JSON.stringify({ slug, token, entry: expiry ? `${hash}@${expiry}` : hash }));
