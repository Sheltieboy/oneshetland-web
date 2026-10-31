import type { ReactNode } from "react";

/** The header band shared by the Notices pages (navy, like the account area; red is not used here). */
export function NoticesHeader({ eyebrow = "Community", title, intro, tone = "navy" }: { eyebrow?: string; title: string; intro?: ReactNode; tone?: "navy" | "quiet" }) {
  const bg = tone === "quiet" ? "#2b3a47" : "#032f4c";
  return (
    <section className="text-paper" style={{ background: bg }}>
      <div className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
        <p className="eyebrow text-paper/80">{eyebrow}</p>
        <h1 className="mt-2 font-display text-4xl font-bold leading-none sm:text-6xl">{title}</h1>
        {intro && <p className="mt-4 max-w-2xl text-base text-paper/90 sm:text-lg">{intro}</p>}
      </div>
    </section>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "ok"; children: ReactNode }) {
  const cls = tone === "error" ? "border-rose-300 bg-rose-50 text-rose-900" : tone === "ok" ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-line bg-sand/60 text-ink-soft";
  return <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}
