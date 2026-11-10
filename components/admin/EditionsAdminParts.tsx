import Link from "next/link";
import { StatusPill } from "@/components/admin/AdminUI";
import { TABS, type TabKey } from "@/app/admin/editions/helpers";

/** Server-safe building blocks shared by the Editions admin pages. Same look as the rest of /admin. */
type Tone = "green" | "amber" | "red" | "blue" | "gray" | "purple";
const TONES: Record<string, Tone> = {
  pending: "amber", verified: "green", rejected: "red", suspended: "red", draft: "gray", published: "green", archived: "gray",
  live: "green", expired: "gray", voided: "red", scheduled: "blue",
};
const LABELS: Record<string, string> = { pending: "Identity not checked" };
export const StatePill = ({ s }: { s: string }) => <StatusPill label={LABELS[s] ?? s[0].toUpperCase() + s.slice(1)} tone={TONES[s] ?? "gray"} />;
export const TestPill = () => <StatusPill label="ZZ TEST" tone="purple" />;
export const ParentPill = ({ kind }: { kind: "hub" | "business" | null | undefined }) => (kind ? <StatusPill label={kind === "hub" ? "Hub" : "Business"} tone={kind === "hub" ? "purple" : "blue"} /> : null);
export const FlagPill = ({ children }: { children: React.ReactNode }) => <span className="rounded-pill bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">{children}</span>;
export const ReservedPill = () => <span className="rounded-pill bg-amber-500 px-2.5 py-0.5 text-xs font-bold text-white">Reserved name: check carefully</span>;

export const when = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(iso)) : "";
export const day = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" }).format(new Date(iso)) : "";

export function EditionsTabs({ active, waiting }: { active: TabKey; waiting?: number }) {
  return (
    <nav aria-label="Editions sections" className="mb-6 flex flex-wrap gap-2">
      {TABS.map((t) => (
        <Link key={t.key} href={t.href} aria-current={active === t.key ? "page" : undefined}
          className={"min-h-11 inline-flex items-center rounded-pill px-4 text-sm font-bold transition " + (active === t.key ? "bg-navy text-white" : "border border-line-strong text-ink-soft hover:bg-sand")}>
          {t.label}{t.key === "approvals" && waiting ? <span className="ml-2 rounded-pill bg-rose-100 px-2 py-0.5 text-xs text-rose-700">{waiting}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

export function FilterLinks({ base, param, current, options, path = "/admin/editions" }: { path?: string; base: Record<string, string>; param: string; current: string; options: { value: string; label: string }[] }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label={`Filter by ${param}`}>
      {options.map((o) => {
        const qs = new URLSearchParams({ ...base, ...(o.value ? { [param]: o.value } : {}) }).toString();
        const on = current === o.value;
        return <Link key={o.value || "all"} href={`${path}?${qs}`} aria-current={on ? "true" : undefined}
          className={"rounded-pill px-3 py-1.5 text-xs font-bold " + (on ? "bg-ink text-white" : "border border-line-strong text-ink-soft hover:bg-sand")}>{o.label}</Link>;
      })}
    </div>
  );
}

export function DataTable({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-paper shadow-soft">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-line bg-sand/50 text-xs uppercase tracking-wider text-ink-soft"><tr>{head.map((h) => <th key={h} scope="col" className="px-4 py-2.5 font-bold">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}
export const Td = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => <td className={"px-4 py-3 align-top " + className}>{children}</td>;

export function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
      {rows.map(([k, v]) => <div key={k} className="contents"><dt className="font-bold text-ink-muted">{k}</dt><dd className="min-w-0 break-words text-ink">{v || <span className="text-ink-muted">None</span>}</dd></div>)}
    </dl>
  );
}
export const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-6 rounded-card border border-line bg-paper p-5 shadow-soft"><h2 className="mb-3 font-display text-lg font-bold text-ink">{title}</h2>{children}</section>
);
export const ErrorNote = ({ children }: { children: React.ReactNode }) => <div className="mb-4 rounded-card border border-dashed border-line bg-paper/60 px-6 py-8 text-center text-sm text-ink-muted">{children}</div>;

export function AuditList({ rows, who }: { rows: { id: number; actor: string | null; action: string; detail: Record<string, unknown>; created_at: string; organiser_id?: string | null; edition_id?: string | null }[]; who: Record<string, string> }) {
  if (!rows.length) return <p className="text-sm text-ink-muted">No audit entries yet.</p>;
  return (
    <DataTable head={["When", "Who", "Action", "Detail"]}>
      {rows.map((r) => (
        <tr key={r.id}>
          <Td className="whitespace-nowrap text-ink-muted">{when(r.created_at)}</Td>
          <Td>{r.actor ? who[r.actor] ?? "Staff or system" : "System"}</Td>
          <Td className="font-semibold">{r.action.replace(/_/g, " ")}</Td>
          <Td className="max-w-xs break-words text-ink-soft">{Object.entries(r.detail ?? {}).filter(([, v]) => v !== null && v !== "").map(([k, v]) => `${k.replace(/_/g, " ")}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join(" · ")}</Td>
        </tr>
      ))}
    </DataTable>
  );
}
