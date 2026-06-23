export function AdminHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-3xl font-bold text-ink">{title}</h1>
      {sub && <p className="mt-1 text-ink-soft">{sub}</p>}
    </div>
  );
}

export function StatCard({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className={"rounded-card border bg-paper p-4 shadow-soft " + (alert && value > 0 ? "border-rose-300" : "border-line")}>
      <p className={"font-display text-3xl font-bold " + (alert && value > 0 ? "text-rose-600" : "text-ink")}>{value.toLocaleString()}</p>
      <p className="mt-0.5 text-sm text-ink-muted">{label}</p>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-card border border-dashed border-line bg-paper/60 px-6 py-12 text-center text-sm text-ink-muted">{children}</div>;
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={"rounded-card border border-line bg-paper p-4 shadow-soft " + className}>{children}</div>;
}

export function StatusPill({ label, tone }: { label: string; tone: "green" | "amber" | "red" | "blue" | "gray" | "purple" }) {
  const map: Record<string, string> = {
    green: "bg-emerald-100 text-emerald-700", amber: "bg-amber-100 text-amber-700", red: "bg-rose-100 text-rose-700",
    blue: "bg-blue-100 text-blue-700", gray: "bg-sand text-ink-muted", purple: "bg-violet-100 text-violet-700",
  };
  return <span className={"rounded-pill px-2.5 py-0.5 text-xs font-bold " + map[tone]}>{label}</span>;
}
