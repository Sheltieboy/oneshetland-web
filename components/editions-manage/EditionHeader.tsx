import Link from "next/link";
import type { Edition, Organiser } from "@/lib/editions/types";
import { KIND_LABEL } from "@/lib/editions/types";
import { dateRangeLabel, phaseOf } from "@/lib/editions/rules";
import { PhasePill, TestPill } from "./kit";
import { EditionStatePill } from "./JourneyPanels";

export const EDITION_TABS = [
  { key: "overview", label: "Overview", path: "" },
  { key: "details", label: "Details", path: "/details" },
  { key: "pages", label: "Pages", path: "/pages" },
  { key: "programme", label: "Programme", path: "/programme" },
  { key: "partners", label: "Partners", path: "/partners" },
  { key: "participation", label: "Participation", path: "/participation" },
  { key: "updates", label: "Updates", path: "/updates" },
  { key: "sponsors", label: "Sponsors", path: "/sponsors" },
] as const;
export type EditionTab = (typeof EDITION_TABS)[number]["key"];

/** Breadcrumb, title and the shared tab nav for every page under /organise/[slug]/editions/[edition]. */
export function EditionHeader({ organiser, edition, active }: { organiser: Organiser; edition: Edition; /** "promote" is reached from the overview, not from the tab row. */ active: EditionTab | "promote" }) {
  const root = `/organise/${organiser.slug}/editions/${edition.slug}`;
  return (
    <header className="mb-6">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-muted">
        <Link href="/organise" className="inline-block py-1 hover:underline">Festivals and Editions</Link> <span aria-hidden>/</span>{" "}
        <Link href={`/organise/${organiser.slug}`} className="inline-block py-1 hover:underline">{organiser.name}</Link>
      </nav>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="font-display text-3xl font-bold text-ink">{edition.title}</h1>
        <EditionStatePill edition={edition} showAttention />
        {edition.is_test && <TestPill />}
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
        <span>{KIND_LABEL[edition.kind]} · {dateRangeLabel(edition.starts_on, edition.ends_on)}</span>
        <PhasePill phase={phaseOf(edition)} />
      </p>
      <nav aria-label="Edition sections" className="-mx-4 mt-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1 border-b border-line">
          {EDITION_TABS.map((t) => (
            <li key={t.key}>
              <Link href={`${root}${t.path}`} aria-current={t.key === active ? "page" : undefined}
                className={"-mb-px block border-b-2 px-3.5 py-2.5 text-sm font-semibold transition " + (t.key === active ? "border-navy text-navy" : "border-transparent text-ink-muted hover:text-ink")}>
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
