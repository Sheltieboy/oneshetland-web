import { NextResponse } from "next/server";
import { getUpcomingEvents, isFreeListEvent, type DateRange } from "@/lib/events-data";

export const dynamic = "force-dynamic";

const RANGES: DateRange[] = ["today", "week", "month", "all"];
const PAGE_SIZE = 20;

/**
 * Paginated event rows for the client-side "Load more" button on /whats-on.
 * Mirrors the page's query: category + date range, free-only filter applied
 * after the fetch (same as the app, which filters free locally).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const category = url.searchParams.get("category") ?? undefined;
  const dateParam = url.searchParams.get("date") ?? "all";
  const range: DateRange = RANGES.includes(dateParam as DateRange) ? (dateParam as DateRange) : "all";
  const freeOnly = url.searchParams.get("free") === "1";
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);

  const rows = await getUpcomingEvents({ category, range, limit: PAGE_SIZE, offset });
  const events = freeOnly ? rows.filter(isFreeListEvent) : rows;

  return NextResponse.json({ events, hasMore: !freeOnly && rows.length === PAGE_SIZE });
}
