#!/usr/bin/env node
/**
 * Prints the INTERNAL REVIEW links for the launch-partner previews, for looking at them on your own machine.
 *
 *   node scripts/launch-review-urls.mjs [http://localhost:3100]
 *
 * These are not invitations. Each token is HMAC(LAUNCH_PREVIEW_REVIEW_SECRET, slug) and is accepted only by a
 * development server (`next dev`) that has the same secret in .env.local (see lib/launch-preview/review.ts). A
 * production build rejects them; they are not in the database; they cannot be turned into a real invitation.
 * The secret lives in .env.local only (git-ignored). To make a secret:  openssl rand -hex 24
 */
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";

const base = process.argv[2] ?? "http://localhost:3100";
let secret = process.env.LAUNCH_PREVIEW_REVIEW_SECRET;
if (!secret) {
  try { secret = /^LAUNCH_PREVIEW_REVIEW_SECRET=(.+)$/m.exec(readFileSync(new URL("../.env.local", import.meta.url), "utf8"))?.[1]?.trim(); } catch { /* none */ }
}
if (!secret || secret.length < 24) { console.error("Set LAUNCH_PREVIEW_REVIEW_SECRET (24+ chars) in .env.local first."); process.exit(1); }

const slugs = ["shetland-jewellery", "the-dowry", "peerie-shop", "da-craft-shed", "shetland-soap-company"];
for (const slug of slugs) {
  const token = createHmac("sha256", secret).update(`launch-review:${slug}`).digest("hex");
  console.log(`${slug.padEnd(24)} ${base}/launch/${slug}?invite=${token}`);
}
