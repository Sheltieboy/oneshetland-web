import Link from "next/link";
import { StatusPill } from "@/components/admin/AdminUI";
import { PRIORITY_LABEL, STATUS_LABEL, reasonLabel, type Priority } from "@/lib/fetch-admin/queues";

/** Small presentational pieces for the Fetch operations pages (server components). */
export function PriorityPill({ priority }: { priority?: string }) {
  const p = PRIORITY_LABEL[(priority as Priority) ?? "waiting"] ?? PRIORITY_LABEL.waiting;
  return <StatusPill label={p.label} tone={p.tone} />;
}
export function JobStatus({ status }: { status?: string }) {
  const tone = status === "delivered" ? "green" : status === "undeliverable" ? "red" : status === "cancelled" || status === "expired" ? "gray" : "blue";
  return <StatusPill label={STATUS_LABEL[status ?? ""] ?? status ?? "—"} tone={tone} />;
}
export function Reasons({ codes }: { codes?: string[] }) {
  if (!codes?.length) return null;
  return <span className="text-xs text-ink-soft">{codes.map(reasonLabel).join(" · ")}</span>;
}
export function JobLink({ id, children }: { id: string; children?: React.ReactNode }) {
  return <Link href={`/admin/fetch/jobs/${id}`} className="font-mono text-xs font-semibold text-navy underline">{children ?? id.slice(0, 8)}</Link>;
}
export function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="mb-6">
      <h2 className="mb-2 font-display text-xl font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}
export function KV({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 border-b border-line/60 py-1">
          <dt className="text-ink-muted">{k}</dt><dd className="text-right text-ink">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
export const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
export function LoadError({ error }: { error: string }) {
  return <div className="rounded-card border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>;
}
