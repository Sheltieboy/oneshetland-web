/**
 * jobs-data.server.ts — auth-scoped Work hub reads (cookie session via the
 * server client). SERVER-ONLY: never import this from a client component.
 * Shared types/constants/helpers + public reads live in jobs-data.ts.
 */

import { createClient as createServerClient } from "@/lib/supabase/server";
import { publicClient } from "@/lib/supabase/public";
import {
  safe, hydrateShifts,
  type Job, type JobApplication, type WorkerProfile,
  type Shift, type ShiftApplication,
} from "@/lib/jobs-data";

/* ── Jobs (authed) ───────────────────────────────────────────────────────── */

export async function getSavedJobIds(): Promise<Set<string>> {
  const sb = await createServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return new Set();
  const { data } = await sb.from("saved_jobs").select("job_id").eq("user_id", user.id);
  return new Set((data ?? []).map((r: { job_id: string }) => r.job_id));
}

export async function hasAppliedToJob(jobId: string, userId: string): Promise<boolean> {
  const sb = await createServerClient();
  const { count } = await sb.from("job_applications")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId).eq("applicant_id", userId);
  return (count ?? 0) > 0;
}

export async function getMyJobApplications(userId: string): Promise<JobApplication[]> {
  const sb = await createServerClient();
  return safe((async () => {
    const { data } = await sb.from("job_applications")
      .select("*, job:jobs(id,title,contract_type,posted_as_business_id,business:local_businesses(id,name,logo_url,brand_color,slug,is_verified))")
      .eq("applicant_id", userId)
      .order("applied_at", { ascending: false });
    return (data ?? []) as unknown as JobApplication[];
  })(), []);
}

export async function getJobApplicants(jobId: string): Promise<JobApplication[]> {
  const sb = await createServerClient();
  return safe((async () => {
    const { data } = await sb.from("job_applications")
      .select("*, applicant:profiles!job_applications_applicant_id_fkey(id,full_name,avatar_url)")
      .eq("job_id", jobId)
      .order("applied_at", { ascending: false });
    return (data ?? []) as unknown as JobApplication[];
  })(), []);
}

export type BusinessJob = Job & { is_hidden: boolean; application_count: number };

/** All jobs (open + closed) posted as a given business, with applicant counts. */
export async function getBusinessJobs(businessId: string): Promise<BusinessJob[]> {
  const sb = await createServerClient();
  return safe((async () => {
    const { data } = await sb.from("jobs")
      .select("*, business:local_businesses(id,name,logo_url,brand_color,slug,is_verified)")
      .eq("posted_as_business_id", businessId)
      .order("posted_at", { ascending: false });
    const jobs = (data ?? []) as unknown as (Job & { is_hidden?: boolean })[];
    if (!jobs.length) return [];
    const ids = jobs.map((j) => j.id);
    const { data: apps } = await sb.from("job_applications")
      .select("job_id").in("job_id", ids).neq("status", "withdrawn");
    const counts: Record<string, number> = {};
    for (const a of (apps ?? []) as { job_id: string }[]) counts[a.job_id] = (counts[a.job_id] ?? 0) + 1;
    return jobs.map((j): BusinessJob => ({
      ...j,
      is_hidden: j.is_hidden ?? false,
      application_count: counts[j.id] ?? 0,
    }));
  })(), []);
}

export async function getWorkerProfile(userId: string): Promise<WorkerProfile | null> {
  const sb = await createServerClient();
  const { data } = await sb.from("worker_profiles").select("*").eq("user_id", userId).maybeSingle();
  return (data ?? null) as WorkerProfile | null;
}

export type ShiftWorkerProfile = {
  user_id: string;
  bio: string | null;
  experience_summary: string | null;
  skills: string[] | null;
  qualifications: string[] | null;
  hourly_rate_min: number | null;
  hourly_rate_max: number | null;
  is_open_to_work: boolean | null;
  open_to_categories: string[] | null;
};

/** The shift-side view of the UNIFIED worker profile (shared with Jobs).
 *  `summary` is the canonical "about you" column, aliased to `bio` here. */
export async function getShiftWorkerProfile(userId: string): Promise<ShiftWorkerProfile | null> {
  const sb = await createServerClient();
  return safe((async () => {
    const { data } = await sb
      .from("worker_profiles")
      .select("user_id, bio:summary, experience_summary, skills, qualifications, hourly_rate_min, hourly_rate_max, is_open_to_work, open_to_categories")
      .eq("user_id", userId)
      .maybeSingle();
    return (data ?? null) as ShiftWorkerProfile | null;
  })(), null);
}

/** Local businesses owned by the user — for the "post as" picker. */
export async function getMyBusinesses(userId: string): Promise<{ id: string; name: string; logo_url: string | null }[]> {
  const sb = await createServerClient();
  return safe((async () => {
    const { data } = await sb.from("local_businesses")
      .select("id, name, logo_url").eq("owner_id", userId).eq("is_active", true)
      .order("name", { ascending: true });
    return (data ?? []) as { id: string; name: string; logo_url: string | null }[];
  })(), []);
}

/* ── Shifts (authed) ─────────────────────────────────────────────────────── */

export async function getMyShiftApplication(shiftId: string, workerId: string): Promise<ShiftApplication | null> {
  const sb = await createServerClient();
  const { data } = await sb.from("shift_applications").select("*")
    .eq("shift_id", shiftId).eq("worker_id", workerId).maybeSingle();
  return (data ?? null) as ShiftApplication | null;
}

export async function getMyShiftApplications(workerId: string): Promise<ShiftApplication[]> {
  const sb = await createServerClient();
  return safe((async () => {
    const { data: apps } = await sb.from("shift_applications").select("*")
      .eq("worker_id", workerId).order("created_at", { ascending: false });
    const list = (apps ?? []) as ShiftApplication[];
    if (!list.length) return [];
    const shiftIds = [...new Set(list.map(a => a.shift_id))];
    const { data: shifts } = await sb.from("shifts")
      .select("id, title, start_at, end_at, location_text, pay_type, pay_amount, status")
      .in("id", shiftIds);
    const map = Object.fromEntries((shifts ?? []).map((s: Partial<Shift> & { id: string }) => [s.id, s]));
    return list.map(a => ({ ...a, shift: map[a.shift_id] ?? null }));
  })(), []);
}

export async function getEmployerShifts(employerId: string): Promise<(Shift & { pending_count: number; total_apps: number; checked_out_count: number })[]> {
  const sb = await createServerClient();
  return safe((async () => {
    const { data } = await sb.from("shifts").select("*")
      .eq("employer_id", employerId).order("created_at", { ascending: false });
    const list = (data ?? []) as Shift[];
    if (!list.length) return [];
    const ids = list.map(s => s.id);
    const { data: apps } = await sb.from("shift_applications")
      .select("shift_id, status, check_in_status").in("shift_id", ids).neq("status", "withdrawn");
    const counts: Record<string, { pending: number; total: number; checked_out: number }> = {};
    for (const a of (apps ?? []) as { shift_id: string; status: string; check_in_status: string | null }[]) {
      counts[a.shift_id] ??= { pending: 0, total: 0, checked_out: 0 };
      counts[a.shift_id].total++;
      if (a.status === "pending") counts[a.shift_id].pending++;
      if (a.check_in_status === "checked_out") counts[a.shift_id].checked_out++;
    }
    const hydrated = await hydrateShifts(publicClient(), list);
    return hydrated.map(s => ({
      ...s,
      pending_count: counts[s.id]?.pending ?? 0,
      total_apps: counts[s.id]?.total ?? 0,
      checked_out_count: counts[s.id]?.checked_out ?? 0,
    }));
  })(), []);
}

export type EmployerShiftApplication = ShiftApplication & {
  shift?: { id: string; title: string; start_at: string } | null;
  worker?: { id: string; full_name: string | null; avatar_url: string | null; location_area: string | null; created_at: string } | null;
  workerProfile?: { bio: string | null; experience_summary: string | null; skills: string[] | null; hourly_rate_min: number | null; hourly_rate_max: number | null; qualifications: string[] | null } | null;
};

export async function getEmployerShiftApplications(employerId: string): Promise<EmployerShiftApplication[]> {
  const sb = await createServerClient();
  return safe((async () => {
    const { data: shifts } = await sb.from("shifts").select("id, title, start_at").eq("employer_id", employerId);
    const list = (shifts ?? []) as { id: string; title: string; start_at: string }[];
    if (!list.length) return [];
    const shiftMap = Object.fromEntries(list.map(s => [s.id, s]));
    const { data: apps } = await sb.from("shift_applications").select("*")
      .in("shift_id", list.map(s => s.id)).eq("status", "pending").order("created_at", { ascending: false });
    const appList = (apps ?? []) as ShiftApplication[];
    if (!appList.length) return [];
    const workerIds = [...new Set(appList.map(a => a.worker_id))];
    const [{ data: profiles }, { data: wp }] = await Promise.all([
      sb.from("profiles").select("id, full_name, avatar_url, location_area, created_at").in("id", workerIds),
      sb.from("worker_profiles").select("user_id, bio:summary, experience_summary, skills, hourly_rate_min, hourly_rate_max, qualifications").in("user_id", workerIds),
    ]);
    type WRow = NonNullable<EmployerShiftApplication["worker"]>;
    type WPRow = NonNullable<EmployerShiftApplication["workerProfile"]> & { user_id: string };
    const pMap = Object.fromEntries(((profiles ?? []) as WRow[]).map((p) => [p.id, p]));
    const wpMap = Object.fromEntries(((wp ?? []) as WPRow[]).map((p) => [p.user_id, p]));
    return appList.map((a): EmployerShiftApplication => ({
      ...a,
      shift: shiftMap[a.shift_id] ?? null,
      worker: pMap[a.worker_id] ?? null,
      workerProfile: wpMap[a.worker_id] ?? null,
    }));
  })(), []);
}

/* ── Employer (business) profile ─────────────────────────────────────────── */

export interface EmployerProfile {
  business_name: string | null;
  description: string | null;
  is_verified: boolean;
  logo_url: string | null;
}

export async function getEmployerProfile(userId: string): Promise<EmployerProfile | null> {
  return safe((async () => {
    const sb = await createServerClient();
    const { data } = await sb.from("shift_employer_profiles")
      .select("business_name, description, is_verified, logo_url")
      .eq("id", userId).maybeSingle();
    return (data ?? null) as EmployerProfile | null;
  })(), null);
}
