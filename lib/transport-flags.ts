/**
 * transport-flags.ts — the one switch for the event-page journey planner.
 *
 * The planner (components/events/TravelPlanner.tsx, fed by lib/transit-data.ts and lib/transit-network.json) computes "Getting there / Getting home"
 * from timetables we hold ourselves. Those timetables pre-date the August 2026 bus changes and the October 2026 ferry timetables, and we do not yet
 * have a licence to hold or refresh them, so the planner is OFF and event pages show the official-links panel (GettingThereLinks) instead.
 *
 * Turn it back on ONLY when licensed, accurate, current timetable data is in place (and the stored network has been refreshed from it). Nothing
 * else needs to change: the planner, its data and its tests are untouched.
 */
export const TRANSPORT_PLANNER_ENABLED = false;
