import { NextResponse, type NextRequest } from "next/server";
import { handleGet, handlePost, securityHeaders, type Out } from "@/lib/app-handoff";
import { handoffDeps } from "@/lib/app-handoff.server";

export const dynamic = "force-dynamic";

/**
 * /app-handoff — the website end of "Manage on the website" in the apps. GET only shows a confirmation (it consumes nothing); POST redeems. See lib/app-handoff.ts and
 * docs/editions/APP_HANDOFF_SECURITY.md. Not linked from anywhere on the website.
 */
const send = (o: Out) => {
  const res = o.status === 303 ? new NextResponse(null, { status: 303 }) : new NextResponse(o.body, { status: o.status });
  for (const [k, v] of Object.entries(o.headers)) res.headers.set(k, v);
  for (const c of o.cookies) res.cookies.set(c.name, c.value, c.options);
  return res;
};

export async function GET(request: NextRequest) {
  const code = new URL(request.url).searchParams.get("code");
  return send(await handleGet(request.headers, code, handoffDeps(new URL(request.url).origin)));
}

export async function POST(request: NextRequest) {
  let form: { code?: unknown; csrf?: unknown } = {};
  try {
    const f = await request.formData();
    form = { code: f.get("code"), csrf: f.get("csrf") };
  } catch { /* not a form: treated as missing fields */ }
  return send(await handlePost(request.headers, form, handoffDeps(new URL(request.url).origin)));
}

/** Link scanners often send HEAD. Answer without looking anything up. */
export async function HEAD() {
  return new NextResponse(null, { status: 204, headers: securityHeaders() });
}
