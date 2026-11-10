import Link from "next/link";
import { dateRangeLabel, type Phase } from "@/lib/editions/rules";
import { KIND_LABEL, type Edition, type Organiser } from "@/lib/editions/types";
import { Masthead, Plate } from "./editorial/Masthead";

/**
 * The Edition's masthead. `logo`, `cover` and `focus` arrive already resolved (the Edition's own, else its organiser's; see resolveBrand), so an Edition can use its
 * own cover and title without the organiser's brand being configured again. theme.hero "plain" drops the photograph; any other value is ignored.
 */
export function EditionHero({ edition, organiser, logo, cover, focus, phase, seriesName, programmeHref }: {
  edition: Edition; organiser: Pick<Organiser, "name" | "slug">; logo: string | null; cover: string | null; focus: string; phase: Phase; seriesName: string | null; programmeHref?: string;
}) {
  const showCover = !!cover && edition.theme?.hero !== "plain";
  const label = [edition.year_label, seriesName, KIND_LABEL[edition.kind]].filter(Boolean).join(" · ");
  const day = edition.starts_on.slice(8, 10);
  return (
    <Masthead
      title={edition.title}
      eyebrow={label}
      phase={phase}
      line={edition.summary}
      dateLabel={dateRangeLabel(edition.starts_on, edition.ends_on)}
      ghost={day}
      cover={showCover ? cover : null}
      focus={focus}
      backHref="/editions"
      plate={<Plate name={organiser.name} logo={logo} label="Presented by" href={`/organisers/${organiser.slug}`} />}
      cta={programmeHref ? <Link href={programmeHref} className="ed-btn ed-btn--light">See the programme</Link> : undefined}
    />
  );
}
