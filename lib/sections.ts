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

/**
 * Editions is a destination of its own, but it is NOT in SECTIONS: the footer and the home grid read that list, and nothing about Editions may
 * appear until the public switch is on. It is spliced into the navigation by primaryNav() below, which the header and the mobile menu both use.
 */
export const EDITIONS_NAV: Section = {
  key: "editions",
  label: "Editions",
  href: "/editions",
  color: "#0e7490",
  token: "navy",
  blurb: "Festivals, seasons and special weeks across Shetland.",
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
    key: "shop",
    label: "Shop",
    href: "/shop",
    color: "#7c3aed",
    token: "local",
    blurb: "Everything on sale from Shetland's own shops and makers — knitwear, craft, art, food and drink.",
  },
  {
    key: "directory",
    label: "Directory",
    href: "/directory",
    color: "#4f46e5",
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
    label: "Aald Memories",
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
    key: "jobs",          // the key, and the /jobs URL, stay as they were: links, SEO and analytics all depend on them
    label: "Work",        // what it is called everywhere a person reads it, matching the app's Work tab
    href: "/jobs",
    color: "#2a8b5c",
    token: "jobs",
    blurb: "Jobs and short-notice shifts across Shetland — permanent roles, seasonal posts and same-day work.",
  },
  {
    key: "get-it-done",
    label: "Get it done",
    href: "/get-it-done",
    color: "#2a8b5c",
    token: "jobs",
    blurb: "Describe a job and see which trades actually have room — before you ring round.",
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
    key: "notices",
    label: "Notices",
    href: "/notices",
    color: "#0a4a70",
    token: "navy",
    blurb: "Essential alerts, health and official notices, community notices and funeral announcements.",
  },
  {
    key: "games",
    label: "Games",
    href: "/games",
    color: "#10b981",
    token: "games",
    blurb: "Learn the dialect through play — daily puzzles, head-to-heads and leaderboards.",
  },
  {
    key: "cruise",
    label: "Cruise",
    href: "/cruise",
    color: "#0e6e8c",
    token: "cruise",
    blurb: "Every cruise ship in Lerwick — times, passengers, how busy town will be, and what to do ashore.",
  },
];

/** The handful shown directly in the top navigation bar, in display order.
 *  (Home is the wordmark; Profile lives in the header user menu.) Cruise moved to the "More" menu when Editions took a place in the bar: the bar
 *  only fits eight before it crowds the wordmark and the right-hand actions at 1280px, which is where it appears. */
const PRIMARY_NAV_ORDER = ["whats-on", "local", "shop", "games", "jobs", "directory", "hubs"];
export const PRIMARY_NAV = PRIMARY_NAV_ORDER
  .map((k) => SECTIONS.find((s) => s.key === k))
  .filter((s): s is Section => Boolean(s));

/** Secondary sections tucked behind the "More" menu in the header. Cruise leads it: of this set it is the one people look for most. */
const MORE_NAV_ORDER = ["cruise", "notices", "get-it-done", "spik", "boats", "memories", "fetch"];
export const MORE_NAV = MORE_NAV_ORDER
  .map((k) => SECTIONS.find((s) => s.key === k))
  .filter((s): s is Section => Boolean(s));

/**
 * The top-bar list for this request. Editions sits immediately after What's On, and ONLY when the public switch is on; off, this is PRIMARY_NAV
 * unchanged, so nothing about Editions reaches a visitor. One function, used by both the header and the mobile menu, so the two cannot drift.
 */
export function primaryNav(editionsEnabled: boolean): Section[] {
  if (!editionsEnabled) return PRIMARY_NAV;
  return PRIMARY_NAV.flatMap((s) => (s.key === "whats-on" ? [s, EDITIONS_NAV] : [s]));
}

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
