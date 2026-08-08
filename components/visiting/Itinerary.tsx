import Link from "next/link";
import { SafeImage } from "@/components/ui/SafeImage";

/**
 * The itinerary list, rendered from flat data so both the server (deterministic
 * plan) and the client (Peerie Bot's, fetched after paint) can use it. No Date
 * objects — every time is already a string, because these cross the wire.
 */

export type StopView = {
  id: string;
  name: string;
  href: string;
  image: string | null;
  blurb: string | null;
  kind: "event" | "place";
  startsAt: string | null;
  arrive: string;
  depart: string;
  travel: string;
  travelMode: "walking" | "driving";
  openKnown: boolean | null;
  why: string | null;
  lat: number;
  lng: number;
};

const LOCAL = "#7c3aed";

export function Itinerary({ stops, accent = LOCAL }: { stops: StopView[]; accent?: string }) {
  return (
    <ol className="space-y-3">
      {stops.map((s, i) => (
        <li key={s.id}>
          {/* The travel leg sits ABOVE its stop, so the eye reads "12 minutes,
              then here" in the order you'd live it. */}
          <p className="mb-2 flex items-center gap-2 pl-4 text-xs font-semibold text-ink-muted">
            <span aria-hidden>{s.travelMode === "walking" ? "🚶" : "🚗"}</span>
            {s.travel}
            {i === 0 ? " from Lerwick" : ""}
          </p>
          <div className="flex gap-4 rounded-card border border-line bg-paper p-4 shadow-soft">
            <div className="flex flex-col items-center">
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
                style={{ background: accent }}
              >
                {i + 1}
              </span>
              <span className="mt-1 text-xs font-bold text-ink-soft">{s.arrive}</span>
            </div>

            {s.image && (
              <div className="hidden h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-line sm:block">
                <SafeImage src={s.image} alt="" className="h-full w-full object-cover" fallback={<span />} />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={s.href} className="font-display font-bold text-ink hover:underline">
                  {s.name}
                </Link>
                {s.kind === "event" && s.startsAt && (
                  <span className="rounded-pill bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                    Event · starts {new Date(s.startsAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}
                  </span>
                )}
                {/* Unknown hours is stated, never hidden — most businesses
                    haven't filled theirs in yet. */}
                {s.openKnown === null && s.kind === "place" && (
                  <span className="rounded-pill bg-sand px-2 py-0.5 text-[11px] font-bold text-ink-muted">
                    Check opening times
                  </span>
                )}
                {s.openKnown === true && s.kind === "place" && (
                  <span className="rounded-pill bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                    Open then
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-ink-muted">{s.arrive} – {s.depart}</p>
              {s.blurb && <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{s.blurb}</p>}
              {s.why && (
                <p className="mt-1 text-sm text-ink-soft">
                  <span aria-hidden>✨ </span>{s.why}
                </p>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
