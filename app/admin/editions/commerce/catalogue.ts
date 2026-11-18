/** The Edition package catalogue as the administrator sees it. Pure: no network, no React. Mirrors the database rules so the form can say no before the database does. */
import { toPence } from "@/lib/editions/commerce";

export type CatalogueRow = {
  code: string; name: string; description: string | null; price_pence: number; duration_days: number | null; features: string[]; max_members: number | null; active: boolean; sort: number;
  is_free?: boolean; kind?: "package" | "promotion"; grants?: { discovery_days?: number; homepage_days?: number; grouped?: boolean } | null; retired_at?: string | null;
};

/** The five features every Launch and Showcase package includes, with no member cap. The database refuses anything less. */
export const ALL_FEATURES = ["collect_payments", "memberships", "participation_fees", "offline_records", "csv_export"] as const;
/** The two packages that must always carry every feature and no cap. */
export const FULL_PACKAGE_CODES = ["launch", "showcase"] as const;
export const NO_RESTRICTIONS_NOTE = "Launch and Showcase include all five features (payments, memberships, participation fees, offline records and CSV export) with no member cap. The database refuses a version with fewer features or a cap.";

export const isRetired = (r: Pick<CatalogueRow, "retired_at">) => !!r.retired_at;
export const kindOf = (r: Pick<CatalogueRow, "kind">): "package" | "promotion" => (r.kind === "promotion" ? "promotion" : "package");
export const KIND_WORD: Record<"package" | "promotion", string> = { package: "Package", promotion: "Promotion" };

/** Retired rows are hidden unless asked for; the rest keep the order the database gave (sort, then price). */
export function visibleCatalogue<T extends Pick<CatalogueRow, "retired_at">>(rows: T[], showRetired: boolean): T[] { return showRetired ? rows : rows.filter((r) => !isRetired(r)); }
export const retiredCount = (rows: Pick<CatalogueRow, "retired_at">[]) => rows.filter(isRetired).length;
/** A retired row can be looked at but never switched on or edited. */
export const canEditRow = (r: Pick<CatalogueRow, "retired_at">) => !isRetired(r);

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
/** "14 discovery days", "42 discovery days and 7 homepage days (homepage days inside the discovery period)", or "No promotion". */
export function describeGrants(g: CatalogueRow["grants"]): string {
  const d = Number(g?.discovery_days ?? 0), h = Number(g?.homepage_days ?? 0);
  if (d <= 0 && h <= 0) return "No promotion";
  const parts = [d > 0 ? plural(d, "discovery day") : "", h > 0 ? plural(h, "homepage day") : ""].filter(Boolean).join(" and ");
  return g?.grouped && d > 0 && h > 0 ? `${parts} (homepage days inside the discovery period)` : parts;
}
export function describeIncludes(r: Pick<CatalogueRow, "kind" | "duration_days" | "features" | "max_members">, label: (f: string) => string): string {
  if (kindOf(r) === "promotion") return "Promotion days only: it never extends publishing";
  const f = r.features.length === ALL_FEATURES.length ? "all five features" : r.features.map(label).join(", ") || "publish only";
  return `${r.duration_days ?? "?"} days of publishing · ${f} · ${r.max_members ? `limit ${r.max_members} members` : "no member cap"}`;
}

/* ── creating a row ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Until now the catalogue could only EDIT rows a migration had already written, and `is_free` was taken from the stored row, never from the form.
 * So the one thing the launch needed — a free package — could not be made without SQL. Creation lives here, mirroring every rule the database
 * enforces in admin_upsert_edition_package, so an administrator is told what is wrong before a round trip rather than after it.
 */
export type NewInput = {
  code?: unknown; name?: unknown; description?: unknown; price?: unknown; sort?: unknown; active?: unknown; isFree?: unknown;
  kind?: unknown; durationDays?: unknown; maxMembers?: unknown; discoveryDays?: unknown; homepageDays?: unknown; grouped?: unknown;
};
export type NewPackage = {
  code: string; name: string; description: string | null; price: number; sort: number; active: boolean; isFree: boolean;
  kind: "package" | "promotion"; durationDays: number | null; maxMembers: number | null; grants: { discovery_days?: number; homepage_days?: number; grouped?: boolean };
};
/** A blank box means "none"; anything else must be a whole number of days, and a bad one is null so the caller can say so. */
const wholeDays = (v: unknown): number | null | undefined => {
  const s = String(v ?? "").trim();
  if (!s) return undefined;
  const n = Number(s);
  return Number.isInteger(n) && n >= 0 ? n : null;
};

/** A new package or promotion. Every rule here is also in the database. */
export function validateNew(input: NewInput, existingCodes: readonly string[] = []): { ok: true; value: NewPackage } | { ok: false; error: string } {
  const code = String(input.code ?? "").trim().toLowerCase();
  if (!/^[a-z0-9_]{3,40}$/.test(code)) return { ok: false, error: "The code is 3 to 40 characters: lower-case letters, numbers and underscores." };
  if (existingCodes.includes(code)) return { ok: false, error: "A package with that code already exists. Edit that one, or choose another code." };
  const name = String(input.name ?? "").trim();
  if (name.length < 2 || name.length > 80) return { ok: false, error: "Give it a name of 2 to 80 characters." };
  const kind: "package" | "promotion" = input.kind === "promotion" ? "promotion" : "package";
  const isFree = input.isFree === true;
  const price = isFree ? 0 : toPence(input.price);
  if (price === null) return { ok: false, error: "Enter a price like 249 or 249.00." };
  if (price > 5_000_000) return { ok: false, error: "That price is too high." };
  const active = input.active === true;
  if (active && price === 0 && !isFree) return { ok: false, error: "A package at £0 can only be offered if you tick “Free package”. Do that, or set a price." };

  const d = wholeDays(input.discoveryDays), h = wholeDays(input.homepageDays);
  if (d === null) return { ok: false, error: "Discovery days must be a whole number of days, or blank." };
  if (h === null) return { ok: false, error: "Homepage days must be a whole number of days, or blank." };
  const dd = d ?? 0, hh = h ?? 0;
  if (dd > 365 || hh > 365) return { ok: false, error: "Promotion days must be 365 or fewer." };
  const grants: NewPackage["grants"] = {};
  if (dd > 0) grants.discovery_days = dd;
  if (hh > 0) grants.homepage_days = hh;
  if (input.grouped === true && dd > 0 && hh > 0) grants.grouped = true;
  const common = { code, name, description: String(input.description ?? "").trim().slice(0, 600) || null, price, sort: 0, active, isFree, grants };

  const sortRaw = input.sort === undefined || input.sort === "" ? 0 : Number(input.sort);
  if (!Number.isInteger(sortRaw) || sortRaw < 0 || sortRaw > 1000) return { ok: false, error: "The order must be a whole number from 0 to 1000." };
  common.sort = sortRaw;

  if (kind === "promotion") {
    if (dd + hh <= 0) return { ok: false, error: "A promotion has to grant at least one day of discovery or homepage." };
    if (isFree) return { ok: false, error: "A promotion is sold, not given away. Untick “Free package”." };
    return { ok: true, value: { ...common, kind, durationDays: null, maxMembers: null } };
  }
  const dur = wholeDays(input.durationDays);
  if (dur === null || dur === undefined || dur < 1 || dur > 800) return { ok: false, error: "A package needs a publishing period of 1 to 800 days." };
  const max = wholeDays(input.maxMembers);
  if (max === null || (max !== undefined && max < 1)) return { ok: false, error: "The member limit must be 1 or more, or blank for none." };
  if ((FULL_PACKAGE_CODES as readonly string[]).includes(code)) return { ok: false, error: "That code belongs to an existing package. Choose another." };
  return { ok: true, value: { ...common, kind, durationDays: dur, maxMembers: max ?? null } };
}

/** The arguments for admin_upsert_edition_package when CREATING. A package always carries every feature; a promotion carries none. */
export function newArgs(v: NewPackage) {
  const promo = v.kind === "promotion";
  return {
    p_code: v.code, p_name: v.name, p_description: v.description, p_price: v.price,
    p_days: promo ? null : v.durationDays, p_features: promo ? [] : [...ALL_FEATURES], p_max_members: promo ? null : v.maxMembers,
    p_active: v.active, p_sort: v.sort, p_is_free: v.isFree, p_kind: v.kind, p_grants: v.grants,
  };
}

/** Retiring is one-way and needs a reason, exactly as the database requires. */
export function validateRetire(code: unknown, reason: unknown): { ok: true; code: string; reason: string } | { ok: false; error: string } {
  const c = String(code ?? "").trim();
  if (!/^[a-z0-9_]{3,40}$/.test(c)) return { ok: false, error: "Choose a package to retire." };
  const r = String(reason ?? "").trim();
  if (r.length < 5) return { ok: false, error: "Give a reason of at least 5 characters. It is kept in the audit log." };
  return { ok: true, code: c, reason: r.slice(0, 300) };
}

export type EditInput = { code?: unknown; name?: unknown; price?: unknown; description?: unknown; sort?: unknown; active?: unknown };
/** What the form may change on an existing row: name, description, price, order on the page, on sale or off. Everything else comes from the row itself. */
export function validateEdit(input: EditInput): { ok: true; code: string; name: string; description: string | null; price: number; sort: number; active: boolean } | { ok: false; error: string } {
  const code = String(input.code ?? "").trim(), name = String(input.name ?? "").trim(), price = toPence(input.price);
  if (!/^[a-z0-9_]{3,40}$/.test(code)) return { ok: false, error: "Choose a package to edit." };
  if (name.length < 2 || name.length > 80) return { ok: false, error: "Give it a name of 2 to 80 characters." };
  if (price === null) return { ok: false, error: "Enter a price like 249 or 249.00." };
  if (price > 5_000_000) return { ok: false, error: "That price is too high." };
  const sort = input.sort === undefined || input.sort === "" ? 0 : Number(input.sort);
  if (!Number.isInteger(sort) || sort < 0 || sort > 1000) return { ok: false, error: "The order must be a whole number from 0 to 1000." };
  return { ok: true, code, name, description: String(input.description ?? "").trim().slice(0, 600) || null, price, sort, active: input.active === true };
}

/** The arguments for admin_upsert_edition_package, taking everything that is NOT editable from the stored row so the form can never loosen a rule. */
export function upsertArgs(row: CatalogueRow, e: { name: string; description: string | null; price: number; sort: number; active: boolean }) {
  const promo = kindOf(row) === "promotion";
  const full = (FULL_PACKAGE_CODES as readonly string[]).includes(row.code);
  return {
    p_code: row.code, p_name: e.name, p_description: e.description, p_price: e.price,
    p_days: promo ? null : row.duration_days, p_features: promo ? [] : full ? [...ALL_FEATURES] : row.features, p_max_members: promo || full ? null : row.max_members,
    p_active: e.active, p_sort: e.sort, p_is_free: row.is_free === true, p_kind: kindOf(row), p_grants: row.grants ?? {},
  };
}
