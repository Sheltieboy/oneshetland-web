import { NextResponse, type NextRequest } from "next/server";
import { handleGet, handlePeek, handleRedeem, securityHeaders, type Out } from "@/lib/app-handoff";
import { handoffDeps } from "@/lib/app-handoff.server";

export const dynamic = "force-dynamic";

/**
 * /app-handoff — the website end of "Manage on the website" in the apps. The code is in the URL fragment, so GET carries nothing and consumes nothing; every step that handles the code is
 * a POST with the code in the body. See lib/app-handoff.ts and docs/editions/APP_HANDOFF_SECURITY.md. Not linked from anywhere on the website.
 */
const send = (o: Out) => {
  const res = o.status === 303 ? new NextResponse(null, { status: 303 }) : new NextResponse(o.body, { status: o.status });
  for (const [k, v] of Object.entries(o.headers)) res.headers.set(k, v);
  for (const c of o.cookies) res.cookies.set(c.name, c.value, c.options);
  return res;
};

export async function GET(request: NextRequest) {
  return send(handleGet(handoffDeps(new URL(request.url).origin)));
}

export async function POST(request: NextRequest) {
  let form: { step?: unknown; code?: unknown; csrf?: unknown; number?: unknown } = {};
  try {
    const f = await request.formData();
    form = { step: f.get("step"), code: f.get("code"), csrf: f.get("csrf"), number: f.get("number") };
  } catch { /* not a form: treated as missing fields */ }
  const deps = handoffDeps(new URL(request.url).origin);
  return send(form.step === "peek" ? await handlePeek(request.headers, form, deps) : await handleRedeem(request.headers, form, deps));
}

/** Link scanners often send HEAD. Answer without looking anything up. */
export async function HEAD() {
  return new NextResponse(null, { status: 204, headers: securityHeaders() });
}
