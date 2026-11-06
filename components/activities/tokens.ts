/** Regular Activities' accent: a calm green, distinct from What's On's gold so the two tabs read as two things. */
export const REGULAR = "#0f766e";
export const EVENTS_GOLD = "#d4921a";

/** A hero colour pair per kind of activity: warm and varied, all with white text at AA contrast. Unknown kinds use the Regular Activities teal. */
export const HERO: Record<string, [string, string]> = {
  fitness: ["#0f766e", "#134e4a"], kids_family: ["#a15c07", "#6b3a05"], social: ["#0a4a70", "#032f4c"], arts_crafts: ["#6d28d9", "#3b1a85"],
  sport: ["#15803d", "#14532d"], wellbeing: ["#0e7490", "#134e5c"], music: ["#4338ca", "#2b2573"], learning: ["#1d4ed8", "#1e3a8a"], faith: ["#475569", "#1e293b"], other: ["#0f766e", "#134e4a"],
};
