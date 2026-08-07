import Link from "next/link";
import { getPlannerCandidates } from "@/lib/planner-data";
import {
  buildPlan, schedulePicks, describeLeg, fmtTime, INTERESTS, LERWICK,
  type Candidate, type Interest, type Plan, type Transport,
} from "@/lib/planner";
import { PlanMap } from "@/components/visiting/PlanMap";
import { SafeImage } from "@/components/ui/SafeImage";
import { suggestDayOrder } from "@/lib/plan-ai.server";

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

  let plan: Plan | null = null;
  let headline: { title: string; intro: string } | null = null;

  if (submitted && validWindow) {
    const candidates = await getPlannerCandidates(
      new Date(start.getTime() - 60 * 60000).toISOString(),
      end.toISOString(),
    );

    // Peerie Bot picks WHAT and IN WHAT ORDER; schedulePicks then works out
    // whether that order actually fits and drops what doesn't. If the call
    // fails — no key, a hiccup, a slow night — we fall straight back to the
    // deterministic planner, because a visitor must always get a day.
    const suggestion = await suggestDayOrder({ candidates, start, end, transport, interests: chosen });
    if (suggestion && suggestion.picks.length > 0) {
      const byId = new Map(candidates.map((c) => [c.id, c] as const));
      const scheduled = schedulePicks({ order: suggestion.picks, byId, start, end, transport, startPoint: LERWICK });
      if (scheduled.stops.length >= 2) {
        plan = scheduled;
        headline = { title: suggestion.title, intro: suggestion.intro };
      }
    }
    if (!plan) {
      plan = buildPlan({ candidates, start, end, transport, interests: chosen, startPoint: LERWICK });
    }
  }

  const field = "rounded-xl border border-line bg-paper px-4 py-2.5 text-ink shadow-soft outline-none";
  const lab = "mb-1 block text-sm font-semibold text-ink-soft";

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
        {/* A plain GET form — the resulting URL IS the plan, so it can be shared. */}
        <form method="get" className="rounded-card border border-line bg-paper p-5 shadow-soft">
          <input type="hidden" name="go" value="1" />
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className={lab} htmlFor="date">Which day</label>
              <input id="date" name="date" type="date" defaultValue={date} className={field + " w-full"} />
            </div>
            <div>
              <label className={lab} htmlFor="from">From</label>
              <input id="from" name="from" type="time" defaultValue={from} className={field + " w-full"} />
            </div>
            <div>
              <label className={lab} htmlFor="to">Until</label>
              <input id="to" name="to" type="time" defaultValue={to} className={field + " w-full"} />
            </div>
            <div>
              <label className={lab} htmlFor="transport">Getting about</label>
              <select id="transport" name="transport" defaultValue={transport} className={field + " w-full"}>
                <option value="driving">By car</option>
                <option value="walking">On foot</option>
              </select>
            </div>
          </div>

          <fieldset className="mt-5">
            <legend className={lab}>What are you after?</legend>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((i) => (
                <label
                  key={i.key}
                  className="cursor-pointer rounded-pill border border-line-strong px-3.5 py-1.5 text-sm font-semibold text-ink-soft transition has-[:checked]:border-transparent has-[:checked]:bg-purple-600 has-[:checked]:text-white hover:bg-sand"
                >
                  <input
                    type="checkbox"
                    name="interests"
                    value={i.key}
                    defaultChecked={chosen.includes(i.key)}
                    className="sr-only"
                  />
                  <span aria-hidden>{i.emoji}</span> {i.label}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-faint">Pick none and we&apos;ll give you a bit of everything.</p>
          </fieldset>

          <button
            type="submit"
            className="mt-5 w-full rounded-pill py-3 font-semibold text-white shadow-soft transition hover:brightness-95 sm:w-auto sm:px-8"
            style={{ background: LOCAL }}
          >
            Plan my day
          </button>
        </form>

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
            <section>
              {headline && (
                <p className="mb-1 inline-flex items-center gap-1.5 rounded-pill bg-ink/5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-ink-muted">
                  ✨ Put together by Peerie Bot
                </p>
              )}
              <h2 className="font-display text-2xl font-bold">
                {headline ? headline.title : `Your day — ${plan.stops.length} stop${plan.stops.length === 1 ? "" : "s"}`}
              </h2>
              {headline && <p className="mt-1 max-w-2xl text-ink-soft">{headline.intro}</p>}
              <p className="mt-1 text-ink-muted">
                {fmtTime(plan.startAt)} to {fmtTime(plan.endAt)}
                {plan.unusedMinutes > 30 ? ` · about ${Math.round(plan.unusedMinutes / 60)}h spare at the end` : ""}
                {" · "}travel times are estimates.
              </p>
            </section>

            <PlanMap
              accent={LOCAL}
              points={plan.stops.map((s) => ({
                lat: s.candidate.lat,
                lng: s.candidate.lng,
                label: s.candidate.name,
                time: fmtTime(s.arrive),
              }))}
            />

            <ol className="space-y-3">
              {plan.stops.map((s, i) => (
                <li key={s.candidate.id}>
                  {/* The travel leg sits ABOVE its stop, so the eye reads
                      "12 minutes, then here" in the order you'd live it. */}
                  <p className="mb-2 flex items-center gap-2 pl-4 text-xs font-semibold text-ink-muted">
                    <span aria-hidden>{s.travel.mode === "walking" ? "🚶" : "🚗"}</span>
                    {describeLeg(s.travel)}
                    {i === 0 ? " from Lerwick" : ""}
                  </p>
                  <div className="flex gap-4 rounded-card border border-line bg-paper p-4 shadow-soft">
                    <div className="flex flex-col items-center">
                      <span
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
                        style={{ background: LOCAL }}
                      >
                        {i + 1}
                      </span>
                      <span className="mt-1 text-xs font-bold text-ink-soft">{fmtTime(s.arrive)}</span>
                    </div>

                    {s.candidate.image && (
                      <div className="hidden h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-line sm:block">
                        <SafeImage src={s.candidate.image} alt="" className="h-full w-full object-cover" fallback={<span />} />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={s.candidate.href} className="font-display font-bold text-ink hover:underline">
                          {s.candidate.name}
                        </Link>
                        {s.candidate.kind === "event" && (
                          <span className="rounded-pill bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                            Event · starts {fmtTime(new Date(s.candidate.startsAt!))}
                          </span>
                        )}
                        {/* Unknown hours is stated, never hidden — most
                            businesses haven't filled theirs in yet. */}
                        {s.openKnown === null && s.candidate.kind === "place" && (
                          <span className="rounded-pill bg-sand px-2 py-0.5 text-[11px] font-bold text-ink-muted">
                            Check opening times
                          </span>
                        )}
                        {s.openKnown === true && s.candidate.kind === "place" && (
                          <span className="rounded-pill bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                            Open then
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-ink-muted">
                        {fmtTime(s.arrive)} – {fmtTime(s.depart)}
                      </p>
                      {s.candidate.blurb && (
                        <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{s.candidate.blurb}</p>
                      )}
                      {s.note && (
                        <p className="mt-1 text-sm text-ink-soft">
                          <span aria-hidden>✨ </span>{s.note}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>

            {plan.skipped.length > 0 && (
              <p className="text-sm text-ink-muted">
                Left out: {plan.skipped.map((s) => `${s.name} (${s.reason})`).join(", ")}.
              </p>
            )}

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
