import Link from "next/link";
import { getPlannerCandidates } from "@/lib/planner-data";
import {
  buildPlan, describeLeg, fmtTime, INTERESTS, LERWICK,
  type Interest, type Plan, type Transport,
} from "@/lib/planner";
import { PlanUpgrade } from "@/components/visiting/PlanUpgrade";
import { type StopView } from "@/components/visiting/Itinerary";
import { SafeImage } from "@/components/ui/SafeImage";
import { PlanForm } from "@/components/visiting/PlanForm";

/**
 * /visiting/plan — tell us when you're here and what you're after, get a day.
 *
 * Server-rendered from the query string on purpose: the plan is then a URL you
 * can send to whoever you're travelling with, or open again on the ferry with
 * no account and no app. It also means the itinerary is built before the page
 * paints, so there's no spinner on the thing they came for.
 *
 * The schedule itself is plain code (lib/planner.ts) — a planner has to be
 * right about times, so nothing here is generated.
 */

export const dynamic = "force-dynamic";

const LOCAL = "#7c3aed";

export const metadata = {
  title: "Plan your day in Shetland",
  description:
    "Tell us when you're here and what you're after, and we'll lay out a day — what's on, where to eat, what to see, with travel times and a map.",
};

type SP = {
  date?: string; from?: string; to?: string;
  transport?: string; go?: string;
  /** Checkboxes sharing a name arrive as an ARRAY, not a comma string —
   *  typing this as `string` is how a crash gets past the type-checker. */
  interests?: string | string[];
};

function pad(n: number) { return String(n).padStart(2, "0"); }

export default async function PlanPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;

  const today = new Date();
  const date = sp.date || `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const from = /^\d{2}:\d{2}$/.test(sp.from ?? "") ? sp.from! : "09:00";
  const to = /^\d{2}:\d{2}$/.test(sp.to ?? "") ? sp.to! : "17:00";
  const transport: Transport = sp.transport === "walking" ? "walking" : "driving";
  const raw = sp.interests ?? [];
  const chosen = (Array.isArray(raw) ? raw : raw.split(","))
    .map((v) => v.trim())
    .filter((v): v is Interest => INTERESTS.some((i) => i.key === v));
  const submitted = sp.go === "1";

  const start = new Date(`${date}T${from}:00`);
  const end = new Date(`${date}T${to}:00`);
  const validWindow = end.getTime() > start.getTime();

  // The server builds the PLAIN plan only. Peerie Bot's version is fetched by
  // the browser after paint (PlanUpgrade) — a model call inside a page render
  // is what kept killing this page for signed-in visitors.
  let plan: Plan | null = null;
  if (submitted && validWindow) {
    const candidates = await getPlannerCandidates(
      new Date(start.getTime() - 60 * 60000).toISOString(),
      end.toISOString(),
    );
    plan = buildPlan({ candidates, start, end, transport, interests: chosen, startPoint: LERWICK });
  }

  const stopViews: StopView[] = (plan?.stops ?? []).map((s) => ({
    id: s.candidate.id,
    name: s.candidate.name,
    href: s.candidate.href,
    image: s.candidate.image,
    blurb: s.candidate.blurb,
    kind: s.candidate.kind,
    startsAt: s.candidate.startsAt ?? null,
    arrive: fmtTime(s.arrive),
    depart: fmtTime(s.depart),
    travel: describeLeg(s.travel),
    travelMode: s.travel.mode,
    openKnown: s.openKnown,
    why: s.note ?? null,
    lat: s.candidate.lat,
    lng: s.candidate.lng,
  }));

  return (
    <>
      <section className="relative isolate overflow-hidden text-paper" style={{ background: LOCAL }}>
        <div className="relative mx-auto max-w-5xl px-5 py-12 sm:py-16">
          <Link href="/visiting" className="text-xs font-semibold text-paper/80 underline">← Visiting Shetland</Link>
          <h1 className="mt-3 font-display text-4xl font-bold sm:text-5xl">Plan your day</h1>
          <p className="mt-3 max-w-2xl text-lg text-paper/90">
            Tell us when you&apos;re here and what you fancy. We&apos;ll lay out a day around what&apos;s actually
            on, with travel times between each stop.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-5xl space-y-10 px-5 py-10">
        {/* The form is a client component so Peerie Bot's ring-colour glow
            can run while it thinks. The URL it navigates to is unchanged, so
            the plan stays shareable, and it still submits without JS. */}
        <PlanForm date={date} from={from} to={to} transport={transport} chosen={chosen} />

        {submitted && !validWindow && (
          <p className="rounded-card border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            That finish time is before the start — check the times and try again.
          </p>
        )}

        {plan && plan.stops.length === 0 && (
          <div className="rounded-card border border-line bg-paper p-8 text-center shadow-soft">
            <p className="font-display text-xl font-bold text-ink">Nothing fitted that window</p>
            <p className="mt-2 text-ink-muted">
              Try a longer stretch, a different day, or fewer boxes ticked. Businesses that haven&apos;t told us
              their opening hours are included as &ldquo;check times&rdquo;, so a short window can come up empty.
            </p>
          </div>
        )}

        {plan && plan.stops.length > 0 && (
          <>
            <PlanUpgrade
              fallbackStops={stopViews}
              fallbackSkipped={plan.skipped}
              accent={LOCAL}
              query={{ date, from, to, transport, interests: chosen }}
            />

            <div className="rounded-card border border-line bg-sand/40 p-4 text-sm text-ink-muted">
              <strong className="text-ink">Worth knowing.</strong> Travel times are estimated from distance and
              typical Shetland road speeds, not live traffic, and they lean a little slow. Ferry islands — Yell,
              Unst, Whalsay, Fetlar and the rest — aren&apos;t planned for, because we don&apos;t hold the ferry
              timetables and would rather leave them out than strand you. Anything marked &ldquo;check opening
              times&rdquo; hasn&apos;t told us its hours yet.
            </div>
          </>
        )}

      </main>
    </>
  );
}
