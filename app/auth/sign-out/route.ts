import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Sign out and return home. POST from the header menu. */
export async function POST(request: NextRequest) {
  const sb = await createClient();
  await sb.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
