import Link from "next/link";
import { SCOPES, type CruiseScope } from "@/lib/cruise-shared";

/**
 * Time-scope selector. Season clears the param; others set ?scope=.
 * Scopes with no ships in their window are greyed out and not clickable.
 */
export function ScopePills({
  active,
  available,
}: {
  active: CruiseScope;
  available: Record<Exclude<CruiseScope, "season">, boolean>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {SCOPES.map((s) => {
        const on = s.key === active;
        const disabled = s.key !== "season" && !available[s.key as Exclude<CruiseScope, "season">];

        if (disabled) {
          return (
            <span
              key={s.key}
              aria-disabled="true"
              title="No ships in port in this window"
              className="cursor-not-allowed rounded-pill border border-line bg-sand/40 px-4 py-2 text-sm font-semibold text-ink-faint"
            >
              {s.label}
            </span>
          );
        }
        return (
          <Link
            key={s.key}
            href={s.key === "season" ? "/cruise" : `/cruise?scope=${s.key}`}
            scroll={false}
            aria-current={on ? "page" : undefined}
            className={
              on
                ? "rounded-pill bg-navy px-4 py-2 text-sm font-bold text-paper shadow-soft"
                : "rounded-pill border border-line-strong bg-paper px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-sand"
            }
          >
            {s.label}
          </Link>
        );
      })}
    </div>
  );
}
