/** Small presentational kit for the organiser area. No hooks and no directive, so server and client components can both use it. */
import type { ReactNode } from "react";
import type { EditionStatus, OrganiserStatus } from "@/lib/editions/types";
import type { Phase } from "@/lib/editions/rules";
import { PHASE_LABEL } from "@/lib/editions/rules";

export const inputCls = "auth-input";

export function Field({ label, hint, htmlFor, children }: { label: string; hint?: ReactNode; htmlFor?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-semibold text-ink">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

const BTN = "inline-flex items-center justify-center rounded-pill px-5 py-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:cursor-not-allowed disabled:opacity-50";
export const btnPrimary = `${BTN} bg-navy text-paper hover:bg-navy-light`;
export const btnSecondary = `${BTN} border border-line-strong bg-paper text-ink hover:border-navy`;
export const btnDanger = `${BTN} border border-rose-300 bg-paper text-rose-700 hover:bg-rose-50`;
export const btnQuiet = "text-sm font-semibold text-navy underline-offset-2 hover:underline disabled:opacity-50";

export function Panel({ title, sub, children, tone = "plain", action }: { title?: string; sub?: ReactNode; children: ReactNode; tone?: "plain" | "warm" | "alert"; action?: ReactNode }) {
  const cls = tone === "warm" ? "border-amber-200 bg-amber-50/60" : tone === "alert" ? "border-rose-200 bg-rose-50/60" : "border-line bg-paper";
  return (
    <section className={`rounded-card border p-5 shadow-soft ${cls}`}>
      {(title || action) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="font-display text-xl font-bold text-ink">{title}</h2>}
            {sub && <p className="mt-0.5 text-sm text-ink-soft">{sub}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Result message. role="status"/"alert" inside an aria-live region so it is announced when it appears. */
export function Notice({ msg }: { msg: { ok: boolean; text: string } | null }) {
  return (
    <div aria-live="polite" className="min-h-0">
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={"rounded-lg px-3 py-2 text-sm font-medium " + (msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700")}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

type Tone = "green" | "amber" | "red" | "blue" | "gray" | "purple";
const TONE: Record<Tone, string> = {
  green: "bg-emerald-100 text-emerald-800", amber: "bg-amber-100 text-amber-800", red: "bg-rose-100 text-rose-700",
  blue: "bg-sky-100 text-sky-800", gray: "bg-sand text-ink-soft", purple: "bg-violet-100 text-violet-800",
};
export function Pill({ label, tone = "gray" }: { label: string; tone?: Tone }) {
  return <span className={`inline-block rounded-pill px-2.5 py-0.5 text-xs font-bold ${TONE[tone]}`}>{label}</span>;
}

const ED_TONE: Record<EditionStatus, [string, Tone]> = { draft: ["Draft", "gray"], published: ["Published", "green"], archived: ["Archived", "blue"], suspended: ["Suspended", "red"] };
export const EditionStatusPill = ({ status }: { status: EditionStatus }) => <Pill label={ED_TONE[status][0]} tone={ED_TONE[status][1]} />;

const ORG_TONE: Record<OrganiserStatus, [string, Tone]> = { pending: ["Verification pending", "amber"], verified: ["Verified", "green"], rejected: ["Not verified", "red"], suspended: ["Suspended", "red"] };
export const OrganiserStatusPill = ({ status }: { status: OrganiserStatus }) => <Pill label={ORG_TONE[status][0]} tone={ORG_TONE[status][1]} />;

const PH_TONE: Record<Phase, Tone> = { upcoming: "blue", running: "green", ended: "gray" };
export const PhasePill = ({ phase }: { phase: Phase }) => <Pill label={PHASE_LABEL[phase]} tone={PH_TONE[phase]} />;

export const TestPill = () => <Pill label="Test" tone="purple" />;

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-card border border-dashed border-line-strong bg-paper/60 px-6 py-10 text-center text-sm text-ink-muted">{children}</div>;
}
