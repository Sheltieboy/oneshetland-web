import { NextResponse } from "next/server";

/**
 * /.well-known/apple-app-site-association
 *
 * iOS fetches this to decide whether oneshetland.com links may open the app
 * instead of Safari. Without it, tapping an NFC tile lands on the web page
 * even when the app is installed.
 *
 * Served from a Route Handler rather than public/ so the Team ID comes from an
 * env var — the file must be served as JSON with NO .json extension and no
 * redirect, which is exactly what this gives us.
 *
 * Set APPLE_TEAM_ID in Netlify (Apple Developer → Membership → Team ID).
 * Until it's set we return 503 rather than a malformed file: iOS caches this
 * aggressively, and caching a wrong appID is far worse than caching nothing.
 *
 * Paths must match the deep links declared in the app's app.json:
 *   /t/*    — NFC tiles        /g/*  — gift claims        /give/* — donations
 */

export const dynamic = "force-dynamic";

const BUNDLE_ID = "com.oneshetland.app";

export async function GET() {
  const teamId = process.env.APPLE_TEAM_ID;
  if (!teamId) {
    return NextResponse.json(
      { error: "APPLE_TEAM_ID is not configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const body = {
    applinks: {
      apps: [],
      details: [
        {
          appID: `${teamId}.${BUNDLE_ID}`,
          paths: ["/t/*", "/g/*", "/give/*"],
        },
      ],
    },
  };

  return new NextResponse(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      // Apple re-fetches periodically; an hour keeps changes reasonably fresh
      // without hammering us.
      "Cache-Control": "public, max-age=3600",
    },
  });
}
