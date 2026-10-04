/**
 * preview-work-live.ts — the LIVE state's Work content: real current jobs and real current shifts, read-only, through
 * the same public reads the live site uses. A shift is never invented: if production holds none, `shifts` is empty.
 */
import { getOpenShifts, shiftDisplayBusiness, formatPay } from "@/lib/jobs-data";
import type { ShelfJob } from "@/lib/home-shelves";
import type { WorkJob, WorkShift } from "@/lib/preview-work";

export function mapLiveJobs(jobs: ShelfJob[]): WorkJob[] {
  return jobs.map((j) => ({ kind: "job" as const, id: j.id, title: j.title, employer: j.employer, where: j.where, pay: j.pay_text, contract: j.contract_type, href: `/jobs/${j.id}` }));
}

export async function loadLiveShifts(): Promise<WorkShift[]> {
  const shifts = await getOpenShifts().catch(() => []);
  return shifts.map((s) => ({
    kind: "shift" as const, id: s.id, title: s.title, employer: shiftDisplayBusiness(s).name, where: s.location_text,
    startAt: s.start_at, endAt: s.end_at, rate: formatPay(s.pay_type, s.pay_amount), href: `/shifts/${s.id}`,
  }));
}
