/**
 * jobs-data.ts — the Work hub data layer (Jobs + Shifts) for the web.
 *
 * Mirrors the app's lib/jobs-api.ts and lib/shifts-api.ts. Public listings use
 * publicClient(); user-scoped reads (my applications, employer pipelines, saved
 * jobs, worker profile) use the cookie-authed server client so RLS sees the user.
 * Writes live in client components (components/jobs/*) via the browser client.
 */

import { publicClient } from "@/lib/supabase/public";

// NOTE: this module is imported by BOTH server and client components (for the
// shared types/constants/helpers below), so it must NOT import next/headers.
// Auth-scoped reads that need the cookie session live in jobs-data.server.ts.

export const safe = async <T>(p: PromiseLike<T>, f: T): Promise<T> => {
  try { return await p; } catch { return f; }
};

/* ── Jobs: types ─────────────────────────────────────────────────────────── */

export type ContractType = "full-time" | "part-time" | "casual" | "apprenticeship" | "volunteer" | "freelance";
export type RemoteMode = "on_site" | "hybrid" | "remote";
export type PayPeriod = "hour" | "day" | "week" | "month" | "year" | "total";
export type JobStatus = "open" | "closed" | "filled";
export type JobAppStatus =
  | "applied" | "viewed" | "shortlisted" | "interview" | "offer" | "hired" | "declined" | "withdrawn";

export type JobBusiness = {
  id: string; name: string; logo_url: string | null;
  brand_color: string | null; slug: string | null; is_verified: boolean;
} | null;

export type Job = {
  id: string;
  employer_id: string;
  posted_as_business_id: string | null;
  title: string;
  description: string | null;
  category: string | null;
  location: string | null;
  locality: string | null;
  contract_type: ContractType;
  pay_text: string | null;
  pay_min: number | null;
  pay_max: number | null;
  pay_period: PayPeriod | null;
  pay_hidden: boolean;
  remote_mode: RemoteMode;
  relocation_support: boolean;
  housing_available: boolean;
  is_seasonal: boolean;
  season_label: string | null;
  apply_url: string | null;
  apply_email: string | null;
  is_featured: boolean;
  status: JobStatus;
  expires_at: string | null;
  posted_at: string;
  business?: JobBusiness;
};

export type JobApplication = {
  id: string;
  job_id: string;
  applicant_id: string;
  status: JobAppStatus;
  cover_letter: string | null;
  profile_snapshot: Record<string, unknown>;
  employer_note: string | null;
  applied_at: string;
  job?: (Pick<Job, "id" | "title" | "contract_type" | "posted_as_business_id"> & { business?: JobBusiness }) | null;
  applicant?: { id: string; full_name: string | null; avatar_url: string | null } | null;
};

export type WorkerProfile = {
  user_id: string;
  headline: string | null;
  summary: string | null;
  skills: string[];
  qualifications: string[];
  desired_pay_text: string | null;
  willing_to_relocate: boolean;
  is_diaspora: boolean;
  is_public: boolean;
};

export const CONTRACT_LABELS: Record<ContractType, string> = {
  "full-time": "Full-time", "part-time": "Part-time", casual: "Casual",
  apprenticeship: "Apprenticeship", volunteer: "Volunteer", freelance: "Freelance",
};
export const REMOTE_LABELS: Record<RemoteMode, string> = {
  on_site: "On-site", hybrid: "Hybrid", remote: "Remote",
};
export const JOB_APP_STATUS_LABELS: Record<JobAppStatus, string> = {
  applied: "Applied", viewed: "Viewed", shortlisted: "Shortlisted", interview: "Interview",
  offer: "Offer", hired: "Hired", declined: "Not selected", withdrawn: "Withdrawn",
};
export const PIPELINE_STAGES: JobAppStatus[] = ["applied", "viewed", "shortlisted", "interview", "offer", "hired"];

export const JOB_CATEGORIES = [
  "Hospitality", "Maritime", "Aquaculture", "Energy", "Care", "Health",
  "Retail", "Trades", "Construction", "Tourism", "Education", "Public sector",
  "Office & admin", "Transport", "Crofting", "Other",
] as const;

const PERIOD_SUFFIX: Record<PayPeriod, string> = {
  hour: "/hr", day: "/day", week: "/wk", month: "/mo", year: "/yr", total: "",
};

function fmtMoney(n: number): string {
  return Math.round(n).toLocaleString("en-GB");
}

export function formatJobPay(j: Pick<Job, "pay_min" | "pay_max" | "pay_period" | "pay_hidden" | "pay_text">): string {
  if (j.pay_hidden) return j.pay_text?.trim() || "Competitive";
  const per = j.pay_period ? PERIOD_SUFFIX[j.pay_period] : "";
  if (j.pay_min != null && j.pay_max != null) return `£${fmtMoney(j.pay_min)}–£${fmtMoney(j.pay_max)}${per}`;
  if (j.pay_min != null) return `From £${fmtMoney(j.pay_min)}${per}`;
  if (j.pay_max != null) return `Up to £${fmtMoney(j.pay_max)}${per}`;
  return j.pay_text?.trim() || "Competitive";
}

const JOB_SELECT = "*, business:local_businesses(id,name,logo_url,brand_color,slug,is_verified)";

/* ── Jobs: reads ─────────────────────────────────────────────────────────── */

export type JobFilter = { category?: string; contract_type?: string; keyword?: string; limit?: number };

export async function getJobs(opts: JobFilter = {}): Promise<Job[]> {
  const sb = publicClient();
  return safe((async () => {
    let q = sb.from("jobs")
      .select(JOB_SELECT)
      .eq("is_hidden", false)
      .eq("status", "open")
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order("is_featured", { ascending: false })
      .order("posted_at", { ascending: false })
      .limit(opts.limit ?? 60);
    if (opts.category) q = q.eq("category", opts.category);
    if (opts.contract_type) q = q.eq("contract_type", opts.contract_type);
    if (opts.keyword) {
      const k = opts.keyword.replace(/[%,]/g, "").trim();
      if (k) q = q.or(`title.ilike.%${k}%,description.ilike.%${k}%,category.ilike.%${k}%`);
    }
    const { data } = await q;
    return (data ?? []) as unknown as Job[];
  })(), []);
}

export async function getJob(id: string): Promise<Job | null> {
  const sb = publicClient();
  return safe((async () => {
    const { data } = await sb.from("jobs").select(JOB_SELECT).eq("id", id).maybeSingle();
    return (data ?? null) as unknown as Job | null;
  })(), null);
}

export async function getFeaturedJobs(limit = 4): Promise<Job[]> {
  const sb = publicClient();
  return safe((async () => {
    const { data } = await sb.from("jobs")
      .select(JOB_SELECT)
      .eq("is_hidden", false).eq("status", "open").eq("is_featured", true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order("posted_at", { ascending: false })
      .limit(limit);
    return (data ?? []) as unknown as Job[];
  })(), []);
}

/* ── Shifts: types ───────────────────────────────────────────────────────── */

export type Urgency = "asap" | "today" | "this_week" | "planned";
export type PayType = "hourly" | "fixed" | "negotiable" | "discuss" | "volunteer";
export type ShiftStatus = "draft" | "open" | "filled" | "cancelled" | "completed";
export type ShiftAppStatus = "pending" | "accepted" | "rejected" | "withdrawn";
export type CheckInStatus = "checked_in" | "checked_out" | "employer_confirmed" | null;

export type ShiftBusiness = { id: string; name: string; logo_url: string | null; category: string; address: string | null; is_verified: boolean } | null;
export type ShiftEmployer = { business_name: string; logo_url: string | null; is_verified: boolean } | null;

export type Shift = {
  id: string;
  employer_id: string;
  posted_as_business_id: string | null;
  title: string;
  description: string | null;
  category: string;
  location_text: string;
  start_at: string;
  end_at: string;
  pay_type: PayType;
  pay_amount: number | null;
  positions_total: number;
  positions_filled: number;
  requirements: string[];
  urgency: Urgency;
  status: ShiftStatus;
  boosted_until: string | null;
  employer?: ShiftEmployer;
  business?: ShiftBusiness;
};

export type ShiftApplication = {
  id: string;
  shift_id: string;
  worker_id: string;
  status: ShiftAppStatus;
  message: string | null;
  check_in_status: CheckInStatus;
  checked_in_at: string | null;
  checked_out_at: string | null;
  employer_confirmed_at: string | null;
  created_at: string;
  shift?: Partial<Shift> | null;
};

export const URGENCY_CONFIG: Record<Urgency, { label: string; color: string; bg: string }> = {
  asap: { label: "ASAP", color: "#DC2626", bg: "#FEE2E2" },
  today: { label: "Today", color: "#EA580C", bg: "#FFEDD5" },
  this_week: { label: "This week", color: "#D97706", bg: "#FEF3C7" },
  planned: { label: "Planned", color: "#6B7280", bg: "#F3F4F6" },
};

export const SHIFT_CATEGORY_LABELS: Record<string, string> = {
  hospitality: "Hospitality", maritime: "Maritime & Fishing", oil_gas: "Oil & Gas",
  aquaculture: "Aquaculture", crofting: "Crofting", care: "Care & Support",
  events: "Events", retail: "Retail & Admin", driving: "Driving",
  trades: "Trades", education: "Education", tourism: "Tourism",
};

export const SHIFT_PAY_TYPES: { value: PayType; label: string }[] = [
  { value: "hourly", label: "Hourly" }, { value: "fixed", label: "Fixed fee" },
  { value: "negotiable", label: "Negotiable" }, { value: "discuss", label: "To discuss" },
  { value: "volunteer", label: "Voluntary" },
];

export const SHIFT_REQUIREMENTS = [
  "Driving licence", "Food hygiene cert", "STCW", "PVG", "First aid",
  "Over 18", "Own transport", "Manual handling",
] as const;

export function formatPay(payType: PayType, payAmount: number | null): string {
  if (payType === "volunteer") return "Voluntary";
  if (payType === "negotiable") return "Negotiable";
  if (payType === "discuss") return "To discuss";
  if (!payAmount) return "Pay TBC";
  if (payType === "hourly") return `£${payAmount.toFixed(2)}/hr`;
  return `£${payAmount.toFixed(0)} fixed`;
}

export function formatDuration(startAt: string, endAt: string): string {
  const hrs = (new Date(endAt).getTime() - new Date(startAt).getTime()) / 3_600_000;
  if (hrs < 1) return `${Math.round(hrs * 60)} mins`;
  if (hrs === 1) return "1 hr";
  return Number.isInteger(hrs) ? `${hrs} hrs` : `${hrs.toFixed(1)} hrs`;
}

export function formatShiftDate(startAt: string): string {
  const d = new Date(startAt);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
    + " · " + d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true });
}

export function shiftDisplayBusiness(s: Shift): { name: string; logo_url: string | null; is_verified: boolean } {
  if (s.business) return { name: s.business.name, logo_url: s.business.logo_url, is_verified: s.business.is_verified };
  if (s.employer) return { name: s.employer.business_name, logo_url: s.employer.logo_url, is_verified: s.employer.is_verified };
  return { name: "Employer", logo_url: null, is_verified: false };
}

/* ── Shifts: reads ───────────────────────────────────────────────────────── */

export async function hydrateShifts(sb: ReturnType<typeof publicClient>, shifts: Shift[]): Promise<Shift[]> {
  const employerIds = [...new Set(shifts.map(s => s.employer_id).filter(Boolean))];
  const businessIds = [...new Set(shifts.map(s => s.posted_as_business_id).filter(Boolean) as string[])];
  const [empRes, bizRes] = await Promise.all([
    employerIds.length
      ? sb.from("shift_employer_profiles").select("id, business_name, logo_url, is_verified").in("id", employerIds)
      : Promise.resolve({ data: [] as { id: string; business_name: string; logo_url: string | null; is_verified: boolean }[] }),
    businessIds.length
      ? sb.from("local_businesses").select("id, name, logo_url, category, address, is_verified").in("id", businessIds)
      : Promise.resolve({ data: [] as { id: string; name: string; logo_url: string | null; category: string; address: string | null; is_verified: boolean }[] }),
  ]);
  const empMap = Object.fromEntries((empRes.data ?? []).map((e) => [e.id, e]));
  const bizMap = Object.fromEntries((bizRes.data ?? []).map((b) => [b.id, b]));
  return shifts.map(s => ({
    ...s,
    employer: empMap[s.employer_id] ?? null,
    business: s.posted_as_business_id ? bizMap[s.posted_as_business_id] ?? null : null,
  }));
}

export async function getOpenShifts(category?: string): Promise<Shift[]> {
  const sb = publicClient();
  return safe((async () => {
    let q = sb.from("shifts").select("*")
      .eq("status", "open")
      .gte("end_at", new Date().toISOString())
      .order("start_at", { ascending: true })
      .limit(60);
    if (category) q = q.eq("category", category);
    const { data } = await q;
    const all = (data ?? []) as Shift[];
    const order: Urgency[] = ["asap", "today", "this_week", "planned"];
    const now = new Date().toISOString();
    const boosted = all.filter(s => s.boosted_until && s.boosted_until > now)
      .sort((a, b) => order.indexOf(a.urgency) - order.indexOf(b.urgency));
    const regular = all.filter(s => !s.boosted_until || s.boosted_until <= now)
      .sort((a, b) => order.indexOf(a.urgency) - order.indexOf(b.urgency));
    return hydrateShifts(sb, [...boosted, ...regular]);
  })(), []);
}

export async function getShift(id: string): Promise<Shift | null> {
  const sb = publicClient();
  return safe((async () => {
    const { data } = await sb.from("shifts").select("*").eq("id", id).maybeSingle();
    if (!data) return null;
    const [hydrated] = await hydrateShifts(sb, [data as Shift]);
    return hydrated;
  })(), null);
}
