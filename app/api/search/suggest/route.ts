import { NextResponse, type NextRequest } from "next/server";
import { searchSite } from "@/lib/search-server";
import { SUGGEST_LIMIT } from "@/lib/search";

/**
 * GET /api/search/suggest?q=…  — the live suggestions behind the search box.
 * Public, read-only, one database call, bounded (see lib/search-server.ts). Successful answers may be reused by the visitor's own browser for 30 s
 * (private: NOT the CDN, which on Netlify ignores the query string unless told to vary on it, and would serve one visitor's search to
 * everyone); the server also keeps recent answers briefly (lib/search-server.ts). A failure is never cached.
 */
export async function GET(req: NextRequest) {
  const out = await searchSite(req.nextUrl.searchParams.get("q"), SUGGEST_LIMIT);
  if (!out.ok) return NextResponse.json({ results: [], unavailable: true }, { headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ results: out.hits }, { headers: { "Cache-Control": "private, max-age=30" } });
}
