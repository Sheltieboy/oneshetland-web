/**
 * shetland-time.ts — one timezone, named once.
 *
 * A booking belongs to a Shetland business at a Shetland hour. The instant is
 * stored correctly as timestamptz; what varies is who formats it. Without an
 * explicit zone, `toLocaleString` answers with whatever clock the machine
 * running it happens to keep — so the same 09:30 appointment rendered 09:30 in
 * a browser and 08:30 on a UTC server, and the owner's dashboard disagreed
 * with the customer's confirmation by an hour for the whole of BST.
 *
 * So every booking-facing formatter names the zone. Not an offset: BST and GMT
 * differ, and the timezone database is the only thing that knows which applies
 * on a given date.
 *
 * Mirrored in oneshetland-delivers/lib/shetland-time.ts.
 */
export const SHETLAND_TZ = "Europe/London";

/** The Shetland calendar day an instant falls on, as YYYY-MM-DD — sortable, and
 *  stable wherever the reader is. Grouping slots by the device's day put an
 *  early appointment under the wrong tab for anyone outside the UK. */
export const shetlandDayKey = (d: Date): string =>
  d.toLocaleDateString("en-CA", { timeZone: SHETLAND_TZ });
