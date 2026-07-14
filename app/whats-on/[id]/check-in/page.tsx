import Link from "next/link";
import { requireEventScanner } from "@/lib/events-server";
import { createClient } from "@/lib/supabase/server";
import { fmtLongDateTime } from "@/lib/events-data";
import { CheckInTool } from "@/components/events/CheckInTool";
import type { ScannerStats } from "@/lib/events-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Check in" };

export default async function CheckInPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { event } = await requireEventScanner(id);

  // Best-effort initial counts (the tool refreshes after each scan anyway).
  let initialStats: ScannerStats | null = null;
  try {
    const sb = await createClient();
    const { data } = await sb.rpc("get_event_scanner_stats", { p_event_id: id });
    if (data) initialStats = data as ScannerStats;
  } catch {
    initialStats = null;
  }

  const where = [event.venue, event.locality].filter(Boolean).join(", ");

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Link
        href={`/whats-on/${event.id}`}
        className="text-sm font-semibold text-ink-soft hover:text-ink"
      >
        ← {event.title}
      </Link>
      <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Check in attendees</h1>
      <p className="mt-1 mb-6 text-ink-muted">
        {fmtLongDateTime(event.starts_at)}
        {where ? ` · ${where}` : ""}
      </p>

      <CheckInTool eventId={event.id} initialStats={initialStats} />

      <p className="mt-8 text-xs text-ink-faint">
        Camera QR scanning is available in the OneShetland app. On the web, enter the
        attendee&apos;s code by hand — many barcode scanners and phone keyboards can paste it
        straight into the field above.
      </p>
    </div>
  );
}
