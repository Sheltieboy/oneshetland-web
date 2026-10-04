import Link from "next/link";
import { STATES, type PreviewState, type PreviewViewer } from "@/lib/preview-v2";

/**
 * The preview switch. Plain links (no client code): each pill reloads the same route with ?state= and ?as=.
 * It is the only thing on the page that is not part of the design, so it is deliberately plain and sits above it.
 */
export function PreviewBar({ route, state, viewer, other }: { route: string; state: PreviewState; viewer: PreviewViewer; other: { label: string; href: string } }) {
  const href = (s: PreviewState, v: PreviewViewer) => `${route}?state=${s}&as=${v}`;
  const pill = (on: boolean) =>
    "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition " + (on ? "bg-white text-slate-900" : "bg-white/10 text-white/80 hover:bg-white/20");
  return (
    <div className="bg-slate-900 text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-1.5 px-5 py-2">
        <span className="rounded bg-amber-400 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-black">Design preview · not live</span>
        <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Content state">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-white/50">State</span>
          {STATES.map((s) => (
            <Link key={s.key} href={href(s.key, viewer)} title={s.hint} className={pill(state === s.key)}>{s.label}</Link>
          ))}
        </div>
        <div className="flex items-center gap-1.5" aria-label="Viewer">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-white/50">View as</span>
          <Link href={href(state, "public")} className={pill(viewer === "public")}>Public</Link>
          <Link href={href(state, "admin")} className={pill(viewer === "admin")}>Admin QA</Link>
        </div>
        <Link href={`${other.href}?state=${state}&as=${viewer}`} className="ml-auto text-xs font-bold text-amber-300 underline underline-offset-2">{other.label} →</Link>
      </div>
      <p className="mx-auto hidden max-w-6xl px-5 pb-2.5 text-[11px] leading-snug text-white/55 sm:block">
        The Launch seed and Populated states use <strong className="text-white/80">invented sample items</strong> and brand photography so the layout can be judged. Live data and Pre-launch use nothing invented.
        Admin QA adds the acceptance fixtures, each marked TEST / QA; Public never shows them.
      </p>
    </div>
  );
}
