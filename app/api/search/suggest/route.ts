import { NextResponse, type NextRequest } from "next/server";
import { searchSite } from "@/lib/search-server";
import { SUGGEST_LIMIT, RESULTS_LIMIT, parseScope, trimWeak, capPerKind } from "@/lib/search";

/**
 * GET /api/search/suggest?q=…&scope=all|business|event|job|boat|spik|hub — the live suggestions behind EVERY search box.
 * ONE database call per distinct text, whatever the scope: the RPC is asked for its full (capped) answer and the scope only filters
 * it here, so a Directory box and a header box typing the same text share one cached answer and cost the database nothing extra.
 * Public, read-only, bounded (see lib/search-server.ts). Successful answers may be reused by the visitor's own browser for 30 s
 * (private: NOT the CDN, which on Netlify ignores the query string unless told to vary on it and would serve one visitor's search
 * to everyone). A failure is never cached.
 */
export async function GET(req: NextRequest) {
  const out = await searchSite(req.nextUrl.searchParams.get("q"), RESULTS_LIMIT);
  if (!out.ok) return NextResponse.json({ results: [], unavailable: true }, { headers: { "Cache-Control": "no-store" } });
  const scope = parseScope(req.nextUrl.searchParams.get("scope"));
  const inScope = scope === "all" ? out.hits : out.hits.filter((h) => h.kind === scope);
  const trimmed = trimWeak(inScope);
  const hits = (scope === "all" ? capPerKind(trimmed, 3) : trimmed).slice(0, SUGGEST_LIMIT);
  return NextResponse.json({ results: hits }, { headers: { "Cache-Control": "private, max-age=30" } });
}
