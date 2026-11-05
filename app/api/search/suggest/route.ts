import { NextResponse, type NextRequest } from "next/server";
import { searchSite } from "@/lib/search-server";
import { SUGGEST_LIMIT } from "@/lib/search";

/**
 * GET /api/search/suggest?q=…  — the live suggestions behind the search box.
 * Public, read-only, one database call, bounded (see lib/search-server.ts). Successful answers may be shared by the CDN for 30 s;
 * a failure is never cached.
 */
export async function GET(req: NextRequest) {
  const out = await searchSite(req.nextUrl.searchParams.get("q"), SUGGEST_LIMIT);
  if (!out.ok) return NextResponse.json({ results: [], unavailable: true }, { headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ results: out.hits }, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } });
}
