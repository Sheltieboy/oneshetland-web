import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccount } from "@/lib/auth";
import {
  getShift,
  formatPay, formatDuration, formatShiftDate, shiftDisplayBusiness,
  URGENCY_CONFIG, SHIFT_CATEGORY_LABELS,
} from "@/lib/jobs-data";
import { getMyShiftApplication, getShiftManageApplications, getShiftForViewer } from "@/lib/jobs-data.server";
import { SHIFTS } from "@/components/jobs/JobsUI";
import { ShiftApplyPanel } from "@/components/jobs/ShiftApplyPanel";
import { ShiftOwnerHub } from "@/components/jobs/ShiftOwnerHub";
import { TrackView } from "@/components/analytics/TrackView";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getShift(id);
  return { title: s ? `${s.title} · Shifts` : "Shift" };
}

export default async function ShiftDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Owner-aware read: the owner can still view their shift after cancelling
  // (the anon getShift() would 404 on a cancelled shift).
  const shift = await getShiftForViewer(id);
  if (!shift) notFound();

  const account = await getAccount();
  const isOwner = !!account && shift.employer_id === account.id;
  const application = account && !isOwner ? await getMyShiftApplication(id, account.id) : null;
  const ownerApps = isOwner ? await getShiftManageApplications(id) : [];

  const biz = shiftDisplayBusiness(shift);
  const urg = URGENCY_CONFIG[shift.urgency];
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

      <div className={`mx-auto grid max-w-4xl gap-8 px-5 py-10 sm:py-12${isOwner ? "" : " lg:grid-cols-[1fr_300px]"}`}>
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

          {isOwner && (
            <ShiftOwnerHub
              shift={{
                id: shift.id, title: shift.title, status: shift.status,
                positions_filled: shift.positions_filled, positions_total: shift.positions_total,
                start_at: shift.start_at, end_at: shift.end_at, posted_as_business_id: shift.posted_as_business_id,
                boosted_until: shift.boosted_until,
              }}
              applications={ownerApps.map((a) => ({
                id: a.id, worker_id: a.worker_id, status: a.status, message: a.message,
                check_in_status: a.check_in_status, checked_in_at: a.checked_in_at,
                checked_out_at: a.checked_out_at, employer_confirmed_at: a.employer_confirmed_at,
                workerName: a.worker?.display_name || a.worker?.full_name || "Applicant",
                workerArea: a.worker?.location_area ?? null, memberSince: a.worker?.created_at ?? null,
                bio: a.workerProfile?.bio ?? null, skills: a.workerProfile?.skills ?? null,
                experience: a.workerProfile?.experience_summary ?? null,
                rateMin: a.workerProfile?.hourly_rate_min ?? null, rateMax: a.workerProfile?.hourly_rate_max ?? null,
                qualifications: a.workerProfile?.qualifications ?? null,
              }))}
            />
          )}
        </div>

        {!isOwner && (
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <ShiftApplyPanel
              shiftId={shift.id}
              isLoggedIn={!!account}
              startAt={shift.start_at}
              endAt={shift.end_at}
              isFull={spotsLeft === 0}
              application={application ? {
                id: application.id, status: application.status, check_in_status: application.check_in_status,
                checked_in_at: application.checked_in_at, checked_out_at: application.checked_out_at,
              } : null}
            />
          </aside>
        )}
      </div>
    </>
  );
}
