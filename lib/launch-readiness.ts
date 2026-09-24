/**
 * launch-readiness.ts — the model behind /admin/launch-readiness.
 *
 * Types and pure functions only: no data, no I/O, no runtime imports, so the
 * calculation can be executed by tests under plain node. The dataset lives in
 * lib/launch-readiness-data.ts and is loaded only through
 * lib/launch-readiness.server.ts (server-only).
 *
 * The percentage is a weighted mean of status contributions over launch-scope
 * items. It never hides blockers: the blocker count is computed separately and
 * the page states "launch blockers remain" whenever it is above zero.
 */

export const STATUSES = ["complete", "needs_verification", "in_progress", "blocked", "not_started"] as const;
export type Status = (typeof STATUSES)[number];

export const CRITICALITIES = ["launch_blocker", "important", "nice_to_have"] as const;
export type Criticality = (typeof CRITICALITIES)[number];

/** What each status contributes to the weighted percentage. */
export const STATUS_CONTRIBUTION: Record<Status, number> = {
  complete: 1,
  needs_verification: 0.75,
  in_progress: 0.5,
  blocked: 0,
  not_started: 0,
};

export const STATUS_LABEL: Record<Status, string> = {
  complete: "Complete",
  needs_verification: "Needs verification",
  in_progress: "In progress",
  blocked: "Blocked",
  not_started: "Not started",
};

export const CRITICALITY_LABEL: Record<Criticality, string> = {
  launch_blocker: "Launch blocker",
  important: "Important",
  nice_to_have: "Nice to have",
};

export interface ReadinessCategory {
  id: string;
  title: string;
}

export interface ReadinessItem {
  /** Stable, kebab-case, never reused. Future tasks address items by this. */
  id: string;
  /** A ReadinessCategory id. */
  area: string;
  title: string;
  description: string;
  status: Status;
  criticality: Criticality;
  /** Relative importance, 1–10. Blocker systems carry more than polish. */
  weight: number;
  /** What proves the status — commit, test, physical check — or what is missing. */
  evidence: string;
  nextAction?: string;
  /** ISO date, YYYY-MM-DD: when this item's status or evidence last changed. */
  lastUpdated: string;
  /** "post_launch" items are shown but excluded from the percentage and counts. */
  scope?: "launch" | "post_launch";
}

export interface ReadinessDataset {
  categories: ReadinessCategory[];
  items: ReadinessItem[];
}

export interface ReadinessSummary {
  /** Weighted readiness, floored to a whole percent so it never rounds up to 100. */
  percent: number;
  counts: Record<Status, number>;
  /** Launch-scope items whose criticality is launch_blocker and are not complete. */
  openBlockers: number;
  totalLaunchItems: number;
  /** Latest lastUpdated across all items, or null if there are none. */
  lastUpdated: string | null;
  /** Anything malformed. The page shows these; they never inflate the percentage. */
  issues: string[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const isStatus = (s: unknown): s is Status => (STATUSES as readonly unknown[]).includes(s);
export const isCriticality = (c: unknown): c is Criticality => (CRITICALITIES as readonly unknown[]).includes(c);
export const inLaunchScope = (i: ReadinessItem) => (i.scope ?? "launch") === "launch";

/** A blocker is open until it is genuinely complete — an unknown status stays open. */
export const isOpenBlocker = (i: ReadinessItem) =>
  inLaunchScope(i) && i.criticality === "launch_blocker" && i.status !== "complete";

/** Every structural problem in the dataset, as readable sentences. */
export function validateDataset(data: ReadinessDataset): string[] {
  const issues: string[] = [];
  const areas = new Set(data.categories.map((c) => c.id));
  const seen = new Set<string>();
  for (const i of data.items) {
    const at = `Item "${i.id}"`;
    if (!i.id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(i.id)) issues.push(`${at} has an invalid id.`);
    if (seen.has(i.id)) issues.push(`${at} is duplicated.`);
    seen.add(i.id);
    if (!areas.has(i.area)) issues.push(`${at} names unknown area "${i.area}".`);
    if (!isStatus(i.status)) issues.push(`${at} has unknown status "${String(i.status)}" — counted as 0%.`);
    if (!isCriticality(i.criticality)) issues.push(`${at} has unknown criticality "${String(i.criticality)}".`);
    if (!Number.isFinite(i.weight) || i.weight < 1 || i.weight > 10) {
      issues.push(`${at} has weight ${String(i.weight)} outside 1–10 — counted as 1.`);
    }
    if (!DATE_RE.test(i.lastUpdated) || Number.isNaN(Date.parse(i.lastUpdated))) {
      issues.push(`${at} has an invalid lastUpdated "${i.lastUpdated}".`);
    }
    if (!i.title?.trim() || !i.evidence?.trim()) issues.push(`${at} is missing a title or evidence.`);
  }
  return issues;
}

/** A malformed weight must not let one item dominate or vanish. */
const safeWeight = (w: number) => (Number.isFinite(w) && w >= 1 && w <= 10 ? w : 1);

export function computeReadiness(data: ReadinessDataset): ReadinessSummary {
  const counts: Record<Status, number> = { complete: 0, needs_verification: 0, in_progress: 0, blocked: 0, not_started: 0 };
  const launch = data.items.filter(inLaunchScope);
  let earned = 0;
  let possible = 0;
  for (const i of launch) {
    const w = safeWeight(i.weight);
    possible += w;
    // Unknown status contributes nothing but still carries its weight, so it
    // can only pull the percentage down — never up.
    if (isStatus(i.status)) {
      earned += w * STATUS_CONTRIBUTION[i.status];
      counts[i.status] += 1;
    }
  }
  const percent = possible === 0 ? 0 : Math.floor((earned / possible) * 100 + 1e-9);
  const dates = data.items.map((i) => i.lastUpdated).filter((d) => DATE_RE.test(d)).sort();
  return {
    percent,
    counts,
    openBlockers: launch.filter(isOpenBlocker).length,
    totalLaunchItems: launch.length,
    lastUpdated: dates.length ? dates[dates.length - 1] : null,
    issues: validateDataset(data),
  };
}

export const FILTERS = ["all", "blockers", "attention", "complete"] as const;
export type ReadinessFilter = (typeof FILTERS)[number];

export const FILTER_LABEL: Record<ReadinessFilter, string> = {
  all: "All",
  blockers: "Launch blockers",
  attention: "Needs attention",
  complete: "Complete",
};

export const parseFilter = (v: unknown): ReadinessFilter =>
  (FILTERS as readonly unknown[]).includes(v) ? (v as ReadinessFilter) : "all";

/**
 * blockers  — open launch blockers.
 * attention — anything waiting on a decision or a check: blocked, needs
 *             verification, an unknown status, or an open blocker.
 * complete  — done.
 */
export function matchesFilter(i: ReadinessItem, f: ReadinessFilter): boolean {
  switch (f) {
    case "all": return true;
    case "blockers": return isOpenBlocker(i);
    case "attention": return i.status === "blocked" || i.status === "needs_verification" || !isStatus(i.status) || isOpenBlocker(i);
    case "complete": return i.status === "complete";
  }
}

export function filterItems(items: ReadinessItem[], f: ReadinessFilter, area?: string | null): ReadinessItem[] {
  return items.filter((i) => matchesFilter(i, f) && (!area || i.area === area));
}

/** Most recently completed first; ties broken by id so the order is stable. */
export function recentlyCompleted(items: ReadinessItem[], limit = 8): ReadinessItem[] {
  return items
    .filter((i) => i.status === "complete" && DATE_RE.test(i.lastUpdated))
    .sort((a, b) => (a.lastUpdated === b.lastUpdated ? a.id.localeCompare(b.id) : a.lastUpdated < b.lastUpdated ? 1 : -1))
    .slice(0, limit);
}

/** Display order inside a section: open blockers, then by status urgency, then weight. */
const STATUS_ORDER: Record<Status, number> = { blocked: 0, in_progress: 1, needs_verification: 2, not_started: 3, complete: 4 };
export function sortForDisplay(items: ReadinessItem[]): ReadinessItem[] {
  return [...items].sort((a, b) =>
    Number(isOpenBlocker(b)) - Number(isOpenBlocker(a)) ||
    (STATUS_ORDER[a.status] ?? -1) - (STATUS_ORDER[b.status] ?? -1) ||
    b.weight - a.weight ||
    a.id.localeCompare(b.id));
}
