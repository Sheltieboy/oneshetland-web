import { NextResponse } from "next/server";
import { getEventsInMonth } from "@/lib/events-data";

export const dynamic = "force-dynamic";

/** Events within a given month, for the client month-grid navigation. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const year = parseInt(url.searchParams.get("year") ?? "", 10);
  const month = parseInt(url.searchParams.get("month") ?? "", 10);
  if (Number.isNaN(year) || Number.isNaN(month) || month < 0 || month > 11) {
    return NextResponse.json({ events: [] });
  }
  const events = await getEventsInMonth(year, month);
  return NextResponse.json({ events });
}
