import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccount } from "@/lib/auth";
import {
  getShift,
  formatPay, formatDuration, formatShiftDate, shiftDisplayBusiness,
  URGENCY_CONFIG, SHIFT_CATEGORY_LABELS,
} from "@/lib/jobs-data";
import { getMyShiftApplication } from "@/lib/jobs-data.server";
import { SHIFTS } from "@/components/jobs/JobsUI";
import { ShiftApplyPanel } from "@/components/jobs/ShiftApplyPanel";
import { TrackView } from "@/components/analytics/TrackView";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getShift(id);
  return { title: s ? `${s.title} · Shifts · OneShetland` : "Shift" };
}

export default async function ShiftDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shift = await getShift(id);
  if (!shift) notFound();

  const account = await getAccount();
  const application = account ? await getMyShiftApplication(id, account.id) : null;

  const biz = shiftDisplayBusiness(shift);
  const urg = URGENCY_CONFIG[shift.urgency];
  const isOwner = !!account && shift.employer_id === account.id;
  const spotsLeft = Math.max(0, shift.positions_total - shift.positions_filled);

  const facts = [
    { label: "When", value: formatShiftDate(shift.start_at) },
    { label: "Duration", value: formatDuration(shift.start_at, shift.end_at) },
    { label: "Pay", value: formatPay(shift.pay_type, shift.pay_amount) },
    { label: "Location", value: shift.location_text },
    ...(SHIFT_CATEGORY_LABELS[shift.category] ? [{ label: "Type", value: SHIFT_CATEGORY_LABELS[shift.category] }] : []),
    { label: "Spots", value: spotsLeft > 0 ? `${spotsLeft} of ${shift.positions_total} left` : "Full" },
  ];

  return (
    <>
      <TrackView event="content_viewed" objectType="shift" objectId={id} />
      <section className="relative isolate overflow-hidden" style={{ background: SHIFTS }}>
        <div className="absolute inset-0" style={{ background: `linear-gradient(160deg,${SHIFTS}f0 30%,${SHIFTS}c0)` }} />
        <div className="relative mx-auto max-w-4xl px-5 py-10 sm:py-12">
          <Link href="/jobs?tab=shifts" className="text-sm font-semibold text-white/85 hover:text-white">← Shifts</Link>
          <div className="mt-4 flex items-start gap-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/30 bg-white/10">
              {biz.logo_url
                ? <img src={biz.logo_url} alt="" className="h-full w-full object-cover" />
                : <div className="grid h-full w-full place-items-center font-display text-2xl font-bold text-white">{biz.name.slice(0, 1)}</div>}
            </div>
            <div className="min-w-0">
              <span className="inline-block rounded-pill px-2.5 py-0.5 text-xs font-bold" style={{ background: urg.bg, color: urg.color }}>{urg.label}</span>
              <h1 className="mt-1 font-display text-3xl font-bold leading-tight text-white sm:text-4xl">{shift.title}</h1>
              <p className="mt-1 text-white/85">{biz.name}{biz.is_verified ? " ✓" : ""}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-4xl gap-8 px-5 py-10 sm:py-12 lg:grid-cols-[1fr_300px]">
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {facts.map((f) => (
              <div key={f.label} className="rounded-card border border-line bg-paper p-3 shadow-soft">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{f.label}</p>
                <p className="mt-0.5 font-display font-bold text-ink">{f.value}</p>
              </div>
            ))}
          </div>

          {shift.description && (
            <section>
              <h2 className="font-display text-2xl font-bold text-ink">About this shift</h2>
              <p className="mt-3 whitespace-pre-wrap text-ink-soft leading-relaxed">{shift.description}</p>
            </section>
          )}

          {shift.requirements?.length > 0 && (
            <section>
              <h2 className="font-display text-lg font-bold text-ink">Requirements</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {shift.requirements.map((r) => (
                  <span key={r} className="rounded-pill bg-sand px-3 py-1.5 text-sm font-semibold text-ink-soft">✓ {r}</span>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          {isOwner ? (
            <div className="rounded-card border border-line bg-paper p-5 shadow-soft">
              <p className="font-display font-bold text-ink">You posted this shift</p>
              <Link href="/shifts/manage" className="mt-3 block rounded-pill px-4 py-2.5 text-center text-sm font-semibold text-paper transition hover:brightness-95" style={{ background: SHIFTS }}>
                Manage shifts & applicants →
              </Link>
            </div>
          ) : (
            <ShiftApplyPanel
              shiftId={shift.id}
              isLoggedIn={!!account}
              startAt={shift.start_at}
              isFull={spotsLeft === 0}
              application={application ? {
                id: application.id, status: application.status, check_in_status: application.check_in_status,
              } : null}
            />
          )}
        </aside>
      </div>
    </>
  );
}
