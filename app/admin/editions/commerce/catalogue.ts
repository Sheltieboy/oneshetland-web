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
