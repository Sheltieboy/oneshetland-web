import Link from "next/link";
import type { HumanStatus } from "@/lib/fetch/present";
import { pounds } from "@/lib/fetch/present";

/** Shared Fetch v2 presentation (server-safe). The OneShetland design system with the Fetch accent; status is never colour alone. */
export const FETCH_ACCENT = "#e0722a";
export const btnPrimary = "inline-flex items-center justify-center rounded-pill px-5 py-2.5 text-sm font-bold text-white shadow-soft hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-40";
export const btnSecondary = "inline-flex items-center justify-center rounded-pill border border-line-strong bg-paper px-5 py-2.5 text-sm font-semibold text-ink hover:bg-sand focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-40";
export const btnQuiet = "inline-flex items-center justify-center rounded-pill px-3 py-1.5 text-sm font-semibold text-ink-soft underline hover:text-ink focus:outline-none focus-visible:ring-2";
export const field = "mt-1 w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-ink shadow-soft outline-none focus-visible:ring-2 focus-visible:ring-[#e0722a]";
export const label = "block text-sm font-semibold text-ink";

const TONE: Record<HumanStatus["tone"], { box: string; icon: string }> = {
  neutral: { box: "border-line bg-paper", icon: "⏳" },
  good: { box: "border-emerald-300 bg-emerald-50", icon: "✓" },
  attention: { box: "border-amber-300 bg-amber-50", icon: "!" },
  done: { box: "border-emerald-300 bg-paper", icon: "✓" },
  muted: { box: "border-line bg-sand/50", icon: "–" },
};

export function StatusCard({ status }: { status: HumanStatus }) {
  const t = TONE[status.tone];
  return (
    <div role="status" className={`rounded-card border p-4 ${t.box}`}>
      <p className="flex items-center gap-2 font-display text-xl font-bold text-ink">
        <span aria-hidden className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-bold" style={{ color: FETCH_ACCENT }}>{t.icon}</span>
        {status.label}
      </p>
      {status.detail && <p className="mt-1 text-sm text-ink-soft">{status.detail}</p>}
    </div>
  );
}

export function Panel({ title, children, id }: { title?: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} aria-labelledby={title && id ? `${id}-h` : undefined} className="rounded-card border border-line bg-paper p-4 shadow-soft">
      {title && <h2 id={id ? `${id}-h` : undefined} className="mb-2 font-display text-lg font-bold text-ink">{title}</h2>}
      {children}
    </section>
  );
}

export function RouteLine({ from, to, ferry }: { from: string; to: string; ferry?: boolean }) {
  return (
    <p className="font-display text-lg font-bold text-ink">
      {from} <span aria-hidden>→</span><span className="sr-only">to</span> {to}
      {ferry && <span className="ml-2 rounded-pill bg-blue-100 px-2 py-0.5 align-middle text-xs font-bold text-blue-700">Ferry</span>}
    </p>
  );
}

export function Timeline({ items }: { items: { at: string; text: string }[] }) {
  if (!items.length) return <p className="text-sm text-ink-muted">Nothing yet.</p>;
  return (
    <ol className="space-y-2">
      {items.map((e, i) => (
        <li key={i} className="flex gap-3 text-sm">
          <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: FETCH_ACCENT }} />
          <span><span className="font-semibold text-ink">{e.text}</span>
            <span className="block text-xs text-ink-muted">{new Date(e.at).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span></span>
        </li>
      ))}
    </ol>
  );
}

export function MoneyTable({ lines, total, totalLabel = "Expected total" }: { lines: [string, number][]; total: number; totalLabel?: string }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {lines.map(([k, v]) => <tr key={k}><td className="py-1 text-ink-soft">{k}</td><td className="py-1 text-right text-ink">{pounds(v)}</td></tr>)}
        <tr className="border-t border-line"><th scope="row" className="pt-2 text-left font-bold text-ink">{totalLabel}</th><td className="pt-2 text-right font-display text-lg font-bold text-ink">{pounds(total)}</td></tr>
      </tbody>
    </table>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "error" | "ok"; children: React.ReactNode }) {
  const c = { info: "border-blue-200 bg-blue-50 text-blue-900", warn: "border-amber-300 bg-amber-50 text-amber-900", error: "border-rose-300 bg-rose-50 text-rose-900", ok: "border-emerald-300 bg-emerald-50 text-emerald-900" }[tone];
  return <div role={tone === "error" ? "alert" : "status"} className={`rounded-card border p-3 text-sm ${c}`}>{children}</div>;
}

export function PageHead({ kicker = "Fetch", title, sub, back }: { kicker?: string; title: string; sub?: string; back?: { href: string; label: string } }) {
  return (
    <header className="mb-5">
      {back && <Link href={back.href} className="text-sm text-ink-muted underline">← {back.label}</Link>}
      <p className="mt-2 text-xs font-bold uppercase tracking-widest" style={{ color: FETCH_ACCENT }}>{kicker}</p>
      <h1 className="font-display text-3xl font-bold text-ink">{title}</h1>
      {sub && <p className="mt-1 text-ink-soft">{sub}</p>}
    </header>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-5 sm:py-8">{children}</main>;
}
