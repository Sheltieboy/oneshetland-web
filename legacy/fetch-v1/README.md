# Fetch v1 web code (retired)

Moved here by Fetch v2 Step 14A (web branch `fetch-v2-rc`). Kept for reference only: not imported, built, typechecked (`tsconfig.json`
excludes `legacy/`) or linted (`eslint.config.mjs` ignores it).

These components wrote `delivery_requests`, `runs` and `waiting_events` directly from the browser, priced on the client, called
`notify-drivers` / `notify-collected`, and (the header chip) subscribed to raw `delivery_requests` changes — none of which Fetch v2 allows.
The `/fetch/*` pages were replaced in Step 11; `/admin/operations` now forwards to the Fetch operations console (Step 10); the header chip
is `components/fetch/v2/HeaderChip.tsx`. `components/fetch/PlaceAutocomplete.tsx` stays where it is: the business event form uses it.
Delete this folder once Fetch v2 is accepted live.
