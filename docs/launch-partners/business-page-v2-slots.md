# Business Page V2 — render modes and the slots real actions plug into

## Two modes, one component set — same design
`BusinessPageV2` renders a `BusinessPageModel` (`lib/business-page/`).

| | `prepared` | `live` (the future customer page) |
|---|---|---|
| Profile (hero, story, labels, place, order) | the whole draft | the **profile layer** of the prepared / approved draft |
| Commerce (shop, booking, experience, rewards) | example items allowed, each tagged "Example · not live" | **real OneShetland data only** |
| Furniture | "Private draft · Not public" + one sentence | none for customers; in a *private review*: "Future live preview · Not public" + dashed review notes where real content will slot in |

Live is **not** "today's sparse Directory fields": it is the approved profile plus genuine commerce (see `admin-launch-partners.md`).

Guarantees: the builder keeps only the profile from a draft in live mode (`extractProfile`); `enforceLive` strips any example commerce again (including priced hero tiles) before render; the wording that marks something as an example lives in `prepared-copy.ts` and is imported only on prepared/review paths; slots are never offered an example item. Tests protect each.

## Hero
* Visual: photograph → mosaic (≥3 pictures: real products' pictures, or the profile's price-less `hero.gallery`) → deliberate branded card (monogram or logo, rings, accent gradient). Admin may force one (`hero.treatment`); it falls back if the content isn't there. Never an empty rectangle.
* Actions (`heroActions`): Shop, Book, View offers, Experience, Directions, Call, Website — **only for capabilities the business really has**, ordered by emphasis, at most four.

## Slots (`components/business-page/slots.ts`)
Optional render props. Unfilled, the page uses today's non-interactive treatment/links. Filled, the widget appears exactly where reserved — no redesign.

| Slot | Where | Receives | Port from |
|---|---|---|---|
| `follow` | hero, beside the actions | `{ businessId, accent }` | `FollowButton` |
| `productAction` | footer of a real product card, beside the price | `ModelItem` | product purchase / basket |
| `offerAction` | inside a real offer card | `ModelOffer, businessId` | `OfferClaimList` |
| `bookAction` | inside a real service card (replaces the default Book link) | `ModelService, businessId` | `ServicesSection` slot picker |
| `passAction` | inside a real pass/experience card | `ModelPass, businessId` | `UnitItemsSection` |
| `rewardsProgress` | under a real rewards programme | `businessId` | `LoyaltyProgress` |

Contract: slots receive plain model data, run on the real thing only (never an example), and decide for themselves what a signed-out visitor sees. Anything needing the viewer's session is a client component rendered inside the slot.

## Map
`BusinessLocationMap` now treats Google rejecting the key (`gm_authFailure` — e.g. a referrer the key does not allow, which is what happens on `localhost`) and an 8-second load timeout as failure and renders the caller's `fallback`. `LocationPanel` supplies a branded location card with the address and "Open in Maps". Google's own error box is never shown.
