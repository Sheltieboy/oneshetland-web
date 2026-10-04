import Link from "next/link";
import { Band, Heading } from "@/components/preview/v2/HomeV2";
import { CropImg } from "@/components/preview/v2/Merch";
import {
  clockRange, curateHome, curateLocal, shiftUrgency, shortDate, workHubHref,
  WORK_HUB, WORK_HUB_SHIFTS, type WorkJob, type WorkSet, type WorkShift,
} from "@/lib/preview-work";

/**
 * Work V2 — jobs AND shifts as one proposition ("Work in Shetland"). Formal vacancies keep the established green
 * vacancy presentation; a shift is told apart at a glance by an amber time block (the same amber the Work hub already
 * uses for Shifts), a clock cue, a derived urgency label and a rate. No new design system.
 */

const JOBS = "#2a8b5c";
const SHIFTS = "#e8a020";
const SHIFT_INK = "#3b2400";
const SHIFT_TEXT = "#92580a";

function Clock({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
  );
}

/** One casual shift: time block · what/where · rate. `compact` is the Local treatment. */
export function ShiftRow({ s, now, compact = false }: { s: WorkShift; now: Date; compact?: boolean }) {
  const label = shiftUrgency(s.startAt, s.endAt, now);
  const hot = label === "TODAY" || label === "TONIGHT";
  return (
    <Link
      href={s.href}
      data-kind="shift"
      data-urgency={label ?? "none"}
      className="group flex items-stretch overflow-hidden rounded-2xl bg-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
      style={{ boxShadow: hot ? `0 0 0 2px ${SHIFTS}, 0 6px 18px rgba(232,160,32,.25)` : undefined }}
    >
      <span className={`flex shrink-0 flex-col items-center justify-center gap-0.5 text-center ${compact ? "w-[92px] px-2 py-3" : "w-[112px] px-3 py-4 sm:w-36"}`} style={{ background: SHIFTS, color: SHIFT_INK }}>
        <Clock className={compact ? "" : "sm:scale-110"} />
        <span className={`font-black uppercase leading-tight tracking-wider ${compact ? "text-[11px]" : "text-[12px] sm:text-sm"}`}>{label ?? shortDate(s.startAt)}</span>
        <span className={`font-bold tabular-nums ${compact ? "text-[12px]" : "text-[13px] sm:text-base"}`}>{clockRange(s.startAt, s.endAt)}</span>
      </span>
      <span className={`flex min-w-0 flex-1 flex-col justify-center ${compact ? "px-3.5 py-3" : "px-4 py-3.5 sm:px-5"}`}>
        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: SHIFT_TEXT }}>Casual shift</span>
        <span className={`line-clamp-2 font-display font-bold leading-snug text-ink ${compact ? "text-base" : "text-lg sm:text-2xl"}`}>{s.title}</span>
        <span className="truncate text-sm text-ink-muted">{[s.employer, s.where].filter(Boolean).join(" · ")}</span>
        <span className="mt-1 font-bold sm:hidden" style={{ color: SHIFT_TEXT }}>{s.rate}</span>
      </span>
      <span className="hidden shrink-0 items-center pr-4 sm:flex">
        <span className="rounded-pill px-3 py-1.5 text-sm font-black" style={{ background: SHIFTS + "26", color: SHIFT_TEXT }}>{s.rate}</span>
      </span>
    </Link>
  );
}

function contractLabel(c: string | null): string | null {
  return c ? c.replace(/-/g, " ") : null;
}

/** One formal vacancy, the conventional presentation. */
export function JobRow({ j, compactPay = false }: { j: WorkJob; compactPay?: boolean }) {
  const contract = contractLabel(j.contract);
  return (
    <Link href={j.href} data-kind="job" className="group flex items-center gap-4 rounded-2xl border-l-4 bg-white p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift" style={{ borderColor: JOBS }}>
      <span className="min-w-0 flex-1">
        {contract && <span className="block text-[10px] font-black uppercase tracking-widest" style={{ color: JOBS }}>{contract}</span>}
        <span className="block line-clamp-2 font-display text-lg font-bold leading-snug text-ink">{j.title}</span>
        <span className="mt-0.5 block truncate text-sm text-ink-muted">{[j.employer, j.where].filter(Boolean).join(" · ")}</span>
        {j.pay && compactPay && <span className="mt-1 block text-sm font-bold sm:hidden" style={{ color: JOBS }}>{j.pay}</span>}
      </span>
      {j.pay && <span className={`shrink-0 rounded-pill px-3 py-1 text-xs font-bold ${compactPay ? "hidden sm:block" : ""}`} style={{ background: JOBS + "1a", color: JOBS }}>{j.pay}</span>}
    </Link>
  );
}

/** Neither jobs nor shifts yet: a short, purposeful gateway — not a large empty module. */
export function WorkGateway() {
  return (
    <section>
      <div className="mx-auto max-w-6xl px-5 py-8 sm:py-10">
        <div className="flex flex-col gap-4 rounded-3xl border border-line bg-white p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between sm:p-6" data-work="gateway">
          <div className="min-w-0">
            <p className="eyebrow" style={{ color: JOBS }}>Jobs &amp; shifts</p>
            <h2 className="mt-1 font-display text-2xl font-bold leading-tight text-ink sm:text-3xl">Work in Shetland</h2>
            <p className="mt-1 max-w-xl text-sm text-ink-soft sm:text-base">Jobs, apprenticeships and casual shifts from Shetland employers. The first listings appear here as they&apos;re posted.</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2.5">
            <Link href={WORK_HUB} className="rounded-pill px-5 py-2.5 text-sm font-bold text-white" style={{ background: JOBS }}>See jobs &amp; shifts →</Link>
            <Link href="/jobs/new" className="rounded-pill border border-line-strong px-5 py-2.5 text-sm font-bold text-ink-soft hover:bg-sand">Hiring? Post work</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Home: the curated Work module ──────────────────────────────────────────── */

export function HomeWork({ work, now = new Date() }: { work: WorkSet; now?: Date }) {
  if (work.jobs.length === 0 && work.shifts.length === 0) return <WorkGateway />;
  const { shifts, jobs, moreShifts } = curateHome(work);
  const [lead, ...rest] = jobs;
  return (
    <Band>
      <Heading eyebrow="Jobs & shifts" title="Work in Shetland" color={JOBS} cta={{ label: "See all jobs & shifts", href: workHubHref(work) }} />
      {shifts.length > 0 && (
        <div className="mb-4 grid gap-3">
          {shifts.map((s) => <ShiftRow key={s.id} s={s} now={now} />)}
          {moreShifts > 0 && (
            <Link href={WORK_HUB_SHIFTS} className="justify-self-end text-sm font-bold underline-offset-2 hover:underline" style={{ color: SHIFT_TEXT }}>
              +{moreShifts} more {moreShifts === 1 ? "shift" : "shifts"} →
            </Link>
          )}
        </div>
      )}
      {lead && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <Link href={lead.href} data-kind="job" className="group relative isolate flex min-h-[300px] overflow-hidden rounded-3xl shadow-lift lg:col-span-7">
            <CropImg src="/preview-v2/cafe.jpg" crop={{ cx: 0.55, cy: 0.35, z: 1.2 }} className="absolute inset-0 -z-10" />
            <div className="absolute inset-0 -z-10" style={{ background: "linear-gradient(100deg, rgba(6,78,59,.95) 30%, rgba(6,78,59,.7) 60%, rgba(6,78,59,.25))" }} />
            <div className="flex w-full flex-col justify-between p-6 text-white sm:p-9">
              <span className="self-start rounded-pill bg-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-widest backdrop-blur-sm">Featured vacancy{lead.contract ? ` · ${contractLabel(lead.contract)}` : ""}</span>
              <div>
                <h3 className="max-w-lg font-display text-3xl font-bold leading-[1.05] sm:text-5xl">{lead.title}</h3>
                <p className="mt-3 text-base font-medium text-white/90">{[lead.employer, lead.where].filter(Boolean).join(" · ")}</p>
                {lead.pay && <p className="mt-2 font-display text-2xl font-bold text-emerald-200">{lead.pay}</p>}
                <span className="mt-4 inline-block rounded-pill bg-white px-5 py-2 text-sm font-bold text-emerald-900">View vacancy →</span>
              </div>
            </div>
          </Link>
          <div className="flex flex-col gap-3 lg:col-span-5">
            {rest.map((j) => <JobRow key={j.id} j={j} />)}
          </div>
        </div>
      )}
    </Band>
  );
}

/* ── Local: a compact supporting module ─────────────────────────────────────── */

export function LocalWork({ work, now = new Date() }: { work: WorkSet; now?: Date }) {
  if (work.jobs.length === 0 && work.shifts.length === 0) return <WorkGateway />;
  const { shifts, jobs } = curateLocal(work);
  return (
    <Band>
      <Heading eyebrow="Work" title="Jobs & shifts" color={JOBS} cta={{ label: "See all jobs & shifts", href: workHubHref(work) }} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {shifts.map((s) => <ShiftRow key={s.id} s={s} now={now} compact />)}
        {jobs.map((j) => <JobRow key={j.id} j={j} compactPay />)}
      </div>
    </Band>
  );
}
