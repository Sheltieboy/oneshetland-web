import { NextResponse } from "next/server";

/**
 * /.well-known/assetlinks.json
 *
 * Android App Links verification. The intent filters in the app's app.json use
 * autoVerify, which means Android checks this file before it will open
 * oneshetland.com/t/* in the app. Without it the tap opens Chrome instead.
 *
 * Set ANDROID_CERT_SHA256 in Netlify — the SHA-256 signing-certificate
 * fingerprint (colon-separated hex) from `eas credentials`, or Play Console →
 * Setup → App signing. Note it's the fingerprint of the key Google re-signs
 * with (App signing key), NOT the upload key, or verification fails in
 * production. Both can be listed; see MULTIPLE FINGERPRINTS below.
 *
 * Returns 503 until it's configured rather than shipping an empty list, which
 * would be a valid file asserting "no app may open these links".
 */

export const dynamic = "force-dynamic";

const PACKAGE_NAME = "com.oneshetland.app";

export async function GET() {
  const raw = process.env.ANDROID_CERT_SHA256;
  if (!raw) {
    return NextResponse.json(
      { error: "ANDROID_CERT_SHA256 is not configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  // MULTIPLE FINGERPRINTS: comma-separate them in the env var to trust both the
  // upload key and Play's app-signing key (handy while testing an internal
  // build alongside a store build).
  const fingerprints = raw.split(",").map((f) => f.trim().toUpperCase()).filter(Boolean);

  const body = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: PACKAGE_NAME,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];

  return new NextResponse(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
