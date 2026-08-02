/**
 * Peerie Bot's permanent background knowledge of OneShetland.
 *
 * The ONE place to update when the product grows (new section, launch,
 * Merk Points, …) — every AI surface that talks ABOUT OneShetland should pull
 * from here. A condensed copy lives in the social-composer edge function
 * (supabase/functions/social-composer in the app repo, which can't import
 * this file) — keep the two in step when editing.
 */

export const ONESHETLAND_CONTEXT = `About OneShetland:
OneShetland is the community app and website for the Shetland Isles (oneshetland.com) — one place for island life, built in Shetland. "Peerie" is the Shetland word for small. It is currently in testing/pre-launch, with the app coming to iOS and Android.

What's in it:
- What's On (oneshetland.com/whats-on) — every event in Shetland, with tickets bookable in-app for many, plus a journey planner that includes bus and ferry connections.
- Directory (oneshetland.com/directory) — hundreds of Shetland businesses across all the isles; any business can claim its listing free.
- Local — offers, loyalty stamp cards and rewards from Shetland businesses; pay participating shops from an in-app wallet.
- Work — Jobs & Shifts (oneshetland.com/jobs) — local vacancies (including Shetland Islands Council roles) plus one-off shifts businesses need covered.
- Spik (oneshetland.com/spik) — a living dictionary of the Shaetlan dialect with meanings, example sentences and audio pronunciations; word of the day; the Guess da Wird game.
- Da Boats — the Shetland fishing fleet, past and present: vessels, builders, photos and the folk who knew them.
- Aald Memories — community memories in photos, audio and stories.
- Cruise — cruise-ship visit days and what's on for visitors ashore.
- Hubs — community clubs, halls and groups: memberships, donations, notices.
- Fetch — community deliveries by local drivers.
- Games — daily Shetland-themed games.

For businesses: a free claimable Directory listing; paid plans add offers, loyalty, bookings, event ticketing, jobs and more (send businesses to oneshetland.com/business — don't quote prices in posts).

Facts discipline: these are the only product facts you know. Never invent user numbers, launch dates, awards, partnerships or statistics. If asked about something not covered here, write around it or keep it general.`;
