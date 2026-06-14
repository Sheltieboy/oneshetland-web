/**
 * The OneShetland sections, mapped to web routes. Drives the header nav, the
 * footer, and the home grid. Colours match the app's section palette.
 */
export type Section = {
  key: string;
  label: string;
  href: string;
  color: string; // hex (also available as Tailwind text-/bg- token)
  token: string; // tailwind colour token name
  blurb: string;
};

export const SECTIONS: Section[] = [
  {
    key: "whats-on",
    label: "What's On",
    href: "/whats-on",
    color: "#d4921a",
    token: "events",
    blurb: "Gigs, galas, markets and the Up Helly Aa — everything happening across the isles.",
  },
  {
    key: "local",
    label: "Local",
    href: "/local",
    color: "#7c3aed",
    token: "local",
    blurb: "Shops, makers and services — with loyalty, offers and bookings from Shetland businesses.",
  },
  {
    key: "directory",
    label: "Directory",
    href: "/directory",
    color: "#6b47bf",
    token: "directory",
    blurb: "The full island business directory — find anyone, from cafés to crofters.",
  },
  {
    key: "boats",
    label: "Da Boats",
    href: "/boats",
    color: "#1e3a8a",
    token: "boats",
    blurb: "The fishing fleet, past and present — names, numbers, builders and the folk who knew them.",
  },
  {
    key: "spik",
    label: "Spik",
    href: "/spik",
    color: "#12b3d6",
    token: "spik",
    blurb: "The living Shetland dialect dictionary — thousands of wirds, with meanings and examples.",
  },
  {
    key: "memories",
    label: "Memories",
    href: "/memories",
    color: "#9f1239",
    token: "memories",
    blurb: "A living map of the islands — pin a place, tell its story, leave a photo or a voice note.",
  },
  {
    key: "hubs",
    label: "Hubs",
    href: "/hubs",
    color: "#6b47bf",
    token: "hubs",
    blurb: "A branded home for every club, charity and community group — notices, members, fundraising.",
  },
  {
    key: "jobs",
    label: "Jobs",
    href: "/jobs",
    color: "#2a8b5c",
    token: "jobs",
    blurb: "Work across Shetland — permanent roles, seasonal posts and short-notice shifts.",
  },
  {
    key: "fetch",
    label: "Fetch",
    href: "/fetch",
    color: "#e0722a",
    token: "fetch",
    blurb: "Community delivery — get things brought to your door, the island way.",
  },
  {
    key: "games",
    label: "Games",
    href: "/games",
    color: "#10b981",
    token: "games",
    blurb: "Learn the dialect through play — daily puzzles, head-to-heads and leaderboards.",
  },
];

/** The handful shown directly in the top navigation bar. */
export const PRIMARY_NAV = SECTIONS.filter((s) =>
  ["whats-on", "local", "directory", "boats", "spik", "hubs"].includes(s.key),
);

/** Hero photo per section (in /public/heroes). Sections without one use the
 *  section colour as a tinted fallback. */
export const SECTION_IMAGE: Record<string, string> = {
  "whats-on": "/heroes/events.jpg",
  local: "/heroes/local.jpeg",
  directory: "/heroes/directory.jpg",
  boats: "/heroes/da-boats.jpg",
  jobs: "/heroes/jobs.webp",
  fetch: "/heroes/fetch.jpeg",
  memories: "/heroes/memories.jpg",
};

export function getSection(key: string): Section | undefined {
  return SECTIONS.find((s) => s.key === key);
}
