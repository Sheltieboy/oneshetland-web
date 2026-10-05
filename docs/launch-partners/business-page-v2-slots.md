# Business Page V2 — render modes and the slots real actions plug into

## Two modes, one component set
`BusinessPageV2` renders a `BusinessPageModel` (`lib/business-page/`).

| | `prepared` | `live` |
|---|---|---|
| Audience | admin, and the owner after an approved launch-partner claim | customers |
| Source | genuine data **plus** the prepared draft | genuine data **only** — the draft is discarded before anything is built |
| Examples / suggestions | allowed, each marked "Example · not live" (small tag, not a warning) | **never**: no example products, experience, booking, rewards suggestion, story or "useful" blocks |
| Furniture | "Private draft · Not public" bar + one sentence of explanation | none |
| Empty section | omitted | omitted |

How the live guarantee is held (defence in depth):
1. `buildBusinessPageModel` ignores the draft entirely when `mode === "live"`.
2. `enforceLive` (`sections.ts`) strips every example/suggestion/prepared block from any live model, whatever produced it, and `BusinessPageV2` calls it before rendering.
3. All wording that marks something as an example lives in `lib/business-page/prepared-copy.ts`, imported only on prepared-only paths. A test fails if any live-capable file (model, sections, tokens, loader, the page, location panel, slots, shared primitives) spells out "Example", "Idea", "Not set up", "Replaced by", "could", "Suggestion", "not for sale" or "representative".
4. Slots are never offered an example item.

Content that becomes live is only ever **real data**: the Directory description (About), real products, real bookable services, real passes, a real loyalty programme, real events, hours, location, contact. A prepared story/example only ever reaches customers by the owner's explicit Go-live, which writes real fields (see `admin-launch-partners.md`).

## Hero
* Visual: photograph → product mosaic (≥3 real/example product pictures) → deliberate branded card (monogram or logo, rings, accent gradient). Admin may force one (`hero.treatment`); it falls back if the content isn't there. Never an empty rectangle.
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
