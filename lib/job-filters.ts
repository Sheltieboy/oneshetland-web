/**
 * job-filters.ts — search, category and "Filters" for the Jobs page, as one pure module.
 *
 * WHY
 * Jobs are about to come from many sources, so the page needs real filtering — but it should stay the clean page it is:
 * a search box and category chips, plus ONE "Filters" control. Every option offered is generated from the jobs that are
 * live right now (an area, an employer or a work pattern nobody is hiring for is never shown), and the whole state lives
 * in the URL so a filtered page can be shared or bookmarked.
 *
 * RULES
 *  · Nothing is guessed. Workplace (on-site / hybrid / remote) is used only when the source said so: source_meta.workplace,
 *    or remote_mode hybrid/remote (the column's default "on_site" is not evidence). Permanent only when the source said so.
 *  · Salary bands use STRUCTURED annual pay only (pay_min/pay_max with period year). Hourly, daily and pro-rata pay is never
 *    annualised. A job with no structured salary is never excluded by the salary filter.
 *  · An employer is a filter option only when it has EMPLOYER_MIN_JOBS (3) or more live jobs.
 *  · Sorting uses listed_at (the source's publication date when known, else first seen) — never import time when the source date exists.
 *
 * No React, no I/O: loaded directly by `node --test`.
 */
import { closingLabel, normaliseJobCategory, JOB_CATEGORIES, JOB_AREAS, type JobCategory } from "@/lib/job-taxonomy";

export const EMPLOYER_MIN_JOBS = 3;

export type FilterJob = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  location: string | null;
  locality: string | null;
  contract_type: string;
  pay_min: number | null;
  pay_max: number | null;
  pay_period: string | null;
  remote_mode: string | null;
  source_meta: Record<string, unknown> | null;
  expires_at: string | null;
  listed_at: string | null;
  posted_at: string;
  is_featured?: boolean;
  external_employer_name: string | null;
  business?: { name: string } | null;
};

/* ── Option vocabularies ─────────────────────────────────────────────────── */

export const EMPLOYMENT_OPTIONS = [
  { key: "full-time", label: "Full-time" },
  { key: "part-time", label: "Part-time" },
  { key: "permanent", label: "Permanent" },
  { key: "temporary", label: "Temporary / Fixed-term" },
  { key: "casual", label: "Casual / Relief" },
  { key: "apprenticeship", label: "Apprenticeship / Training" },
] as const;
export type EmploymentKey = (typeof EMPLOYMENT_OPTIONS)[number]["key"];

export const WORKPLACE_OPTIONS = [
  { key: "on_site", label: "On-site" },
  { key: "hybrid", label: "Hybrid" },
  { key: "remote", label: "Remote" },
] as const;
export type WorkplaceKey = (typeof WORKPLACE_OPTIONS)[number]["key"];

export const SALARY_BANDS = [
  { key: "u25", label: "Under £25k", min: 0, max: 25_000 },
  { key: "25-35", label: "£25k–£35k", min: 25_000, max: 35_000 },
  { key: "35-50", label: "£35k–£50k", min: 35_000, max: 50_000 },
  { key: "50-75", label: "£50k–£75k", min: 50_000, max: 75_000 },
  { key: "75p", label: "£75k+", min: 75_000, max: Infinity },
] as const;
export type SalaryKey = (typeof SALARY_BANDS)[number]["key"];

export type SortKey = "newest" | "closing";

/* ── Facts about a job ───────────────────────────────────────────────────── */

const meta = (j: FilterJob, k: string): string | null => {
  const v = j.source_meta?.[k];
  return typeof v === "string" && v.trim() ? v.trim() : null;
};

export const employerName = (j: FilterJob): string | null =>
  (j.business?.name || j.external_employer_name || "").trim() || null;

/** Every employment option a job satisfies (a permanent part-time post is both "Part-time" and "Permanent"). */
export function employmentTags(j: FilterJob): EmploymentKey[] {
  const out = new Set<EmploymentKey>();
  if (j.contract_type === "full-time") out.add("full-time");
  if (j.contract_type === "part-time") out.add("part-time");
  if (j.contract_type === "temporary") out.add("temporary");
  if (j.contract_type === "casual") out.add("casual");
  if (j.contract_type === "apprenticeship") out.add("apprenticeship");
  const label = meta(j, "contract_label");
  if (label && /permanent/i.test(label)) out.add("permanent");
  if (label && /(fixed|temporary)/i.test(label)) out.add("temporary");
  if (label && /(supply|casual|relief|bank)/i.test(label)) out.add("casual");
  if (label && /(apprentice|trainee|training)/i.test(label)) out.add("apprenticeship");
  const hours = meta(j, "hours_label");
  if (hours && /part/i.test(hours)) out.add("part-time");
  if (hours && /full/i.test(hours)) out.add("full-time");
  return [...out];
}

/** The workplace a source explicitly stated, or null. */
export function workplaceOf(j: FilterJob): WorkplaceKey | null {
  const w = meta(j, "workplace");
  if (w === "on_site" || w === "hybrid" || w === "remote") return w;
  if (j.remote_mode === "hybrid" || j.remote_mode === "remote") return j.remote_mode;
  return null;
}

/** The salary band(s) a job's STRUCTURED ANNUAL pay overlaps; empty when it has none. */
export function salaryBands(j: FilterJob): SalaryKey[] {
  if (j.pay_period !== "year") return [];
  const lo = j.pay_min ?? j.pay_max, hi = j.pay_max ?? j.pay_min;
  if (lo == null || hi == null) return [];
  return SALARY_BANDS.filter((b) => lo < b.max && hi >= b.min).map((b) => b.key);
}

/* ── State <-> URL ───────────────────────────────────────────────────────── */

export type JobFilters = {
  q: string;
  category: JobCategory | null;
  locations: string[];
  employment: EmploymentKey[];
  workplace: WorkplaceKey[];
  salary: SalaryKey[];
  employers: string[];
  sort: SortKey;
};

export const EMPTY_FILTERS: JobFilters = { q: "", category: null, locations: [], employment: [], workplace: [], salary: [], employers: [], sort: "newest" };

type Params = Record<string, string | string[] | undefined> | URLSearchParams;
const many = (p: Params, k: string): string[] => {
  const v = p instanceof URLSearchParams ? p.getAll(k) : p[k];
  const arr = Array.isArray(v) ? v : v == null ? [] : [v];
  return arr.flatMap((s) => String(s).split("|")).map((s) => s.trim()).filter(Boolean);
};
const one = (p: Params, k: string) => many(p, k)[0] ?? "";
const only = <T extends string>(vals: string[], allowed: readonly T[]): T[] => [...new Set(vals.filter((v): v is T => (allowed as readonly string[]).includes(v)))];

/** Read filters from query params; anything unrecognised is ignored, never an error. */
export function parseFilters(p: Params): JobFilters {
  return {
    q: one(p, "q").slice(0, 100),
    category: normaliseJobCategory(one(p, "category")),
    locations: only(many(p, "loc"), JOB_AREAS),
    employment: only(many(p, "emp"), EMPLOYMENT_OPTIONS.map((o) => o.key)),
    workplace: only(many(p, "work"), WORKPLACE_OPTIONS.map((o) => o.key)),
    salary: only(many(p, "sal"), SALARY_BANDS.map((o) => o.key)),
    employers: [...new Set(many(p, "employer"))].slice(0, 20),
    sort: one(p, "sort") === "closing" ? "closing" : "newest",
  };
}

/** Number shown on the Filters button: everything except search, category and sort (those have their own controls). */
export const filterCount = (f: JobFilters): number => f.locations.length + f.employment.length + f.workplace.length + f.salary.length + f.employers.length;
export const hasAnyRefinement = (f: JobFilters): boolean => filterCount(f) > 0 || !!f.q || !!f.category;

/** Query string for the state (stable order, defaults omitted) — what makes a filtered page shareable. */
export function toQuery(f: JobFilters, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  if (f.q) p.set("q", f.q);
  if (f.category) p.set("category", f.category);
  for (const v of f.locations) p.append("loc", v);
  for (const v of f.employment) p.append("emp", v);
  for (const v of f.workplace) p.append("work", v);
  for (const v of f.salary) p.append("sal", v);
  for (const v of f.employers) p.append("employer", v);
  if (f.sort !== "newest") p.set("sort", f.sort);
  return p.toString();
}

/** The same state with one filter value removed (the "x" on an active-filter chip). */
export function without(f: JobFilters, kind: "q" | "category" | "locations" | "employment" | "workplace" | "salary" | "employers", value?: string): JobFilters {
  const next: JobFilters = { ...f, locations: [...f.locations], employment: [...f.employment], workplace: [...f.workplace], salary: [...f.salary], employers: [...f.employers] };
  if (kind === "q") next.q = "";
  else if (kind === "category") next.category = null;
  else (next[kind] as string[]) = (next[kind] as string[]).filter((v) => v !== value);
  return next;
}

/** Everything cleared except the sort order. */
export const clearAll = (f: JobFilters): JobFilters => ({ ...EMPTY_FILTERS, sort: f.sort });

/* ── Applying ────────────────────────────────────────────────────────────── */

const matchesKeyword = (j: FilterJob, q: string): boolean => {
  const hay = [j.title, j.description, j.category, j.location, j.locality, employerName(j)].filter(Boolean).join(" ").toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
};

/** Jobs matching the state. Filters combine with AND across kinds and OR within a kind. */
export function applyFilters<T extends FilterJob>(jobs: readonly T[], f: JobFilters): T[] {
  return jobs.filter((j) => {
    if (f.q && !matchesKeyword(j, f.q)) return false;
    if (f.category && normaliseJobCategory(j.category) !== f.category) return false;
    if (f.locations.length && !(j.locality && f.locations.includes(j.locality))) return false;
    if (f.employment.length) { const t = employmentTags(j); if (!f.employment.some((e) => t.includes(e))) return false; }
    if (f.workplace.length) { const w = workplaceOf(j); if (!w || !f.workplace.includes(w)) return false; }
    if (f.salary.length) {
      const b = salaryBands(j);
      if (b.length && !f.salary.some((s) => b.includes(s))) return false;   // no structured salary => never excluded
    }
    if (f.employers.length && !f.employers.includes(employerName(j) ?? "\u0000")) return false;
    return true;
  });
}

const t = (v: string | null | undefined): number | null => { const n = v ? new Date(v).getTime() : NaN; return Number.isFinite(n) ? n : null; };
const listedAt = (j: FilterJob) => t(j.listed_at) ?? t(j.posted_at) ?? 0;

/** Newest = featured first, then most recently published. Closing soon = soonest closing date first, undated last. */
export function sortJobs<T extends FilterJob>(jobs: readonly T[], sort: SortKey): T[] {
  const out = [...jobs];
  if (sort === "closing") {
    out.sort((a, b) => {
      const x = t(a.expires_at), y = t(b.expires_at);
      if (x === null && y === null) return listedAt(b) - listedAt(a);
      if (x === null) return 1;
      if (y === null) return -1;
      return x - y || listedAt(b) - listedAt(a);
    });
  } else {
    out.sort((a, b) => Number(!!b.is_featured) - Number(!!a.is_featured) || listedAt(b) - listedAt(a));
  }
  return out;
}

/* ── Facets: only what live jobs actually offer ──────────────────────────── */

export type Facets = {
  categories: JobCategory[];
  locations: { value: string; count: number }[];
  employment: { key: EmploymentKey; label: string; count: number }[];
  workplace: { key: WorkplaceKey; label: string; count: number }[];
  salary: { key: SalaryKey; label: string; count: number }[];
  employers: { value: string; count: number }[];
};

export function buildFacets(jobs: readonly FilterJob[]): Facets {
  const cats = new Set<JobCategory>();
  const loc = new Map<string, number>(), emp = new Map<EmploymentKey, number>(), work = new Map<WorkplaceKey, number>();
  const sal = new Map<SalaryKey, number>(), employers = new Map<string, number>();
  for (const j of jobs) {
    const c = normaliseJobCategory(j.category); if (c) cats.add(c);
    if (j.locality) loc.set(j.locality, (loc.get(j.locality) ?? 0) + 1);
    for (const e of employmentTags(j)) emp.set(e, (emp.get(e) ?? 0) + 1);
    const w = workplaceOf(j); if (w) work.set(w, (work.get(w) ?? 0) + 1);
    for (const s of salaryBands(j)) sal.set(s, (sal.get(s) ?? 0) + 1);
    const n = employerName(j); if (n) employers.set(n, (employers.get(n) ?? 0) + 1);
  }
  return {
    categories: JOB_CATEGORIES.filter((c) => cats.has(c)),
    locations: JOB_AREAS.filter((a) => loc.has(a)).map((a) => ({ value: a, count: loc.get(a)! })),
    employment: EMPLOYMENT_OPTIONS.filter((o) => emp.has(o.key)).map((o) => ({ ...o, count: emp.get(o.key)! })),
    workplace: WORKPLACE_OPTIONS.filter((o) => work.has(o.key)).map((o) => ({ ...o, count: work.get(o.key)! })),
    salary: SALARY_BANDS.filter((o) => sal.has(o.key)).map((o) => ({ key: o.key, label: o.label, count: sal.get(o.key)! })),
    employers: [...employers].filter(([, n]) => n >= EMPLOYER_MIN_JOBS).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([value, count]) => ({ value, count })),
  };
}

/** "18 jobs found" / "1 job found" */
export const resultsLabel = (n: number): string => `${n} ${n === 1 ? "job" : "jobs"}${n === 0 ? "" : " found"}`;

export { closingLabel };
