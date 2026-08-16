# Business tier model

**Status:** agreed, not yet implemented · **Decided:** 16 August 2026

This is the specification for OneShetland's business subscription tiers. It replaces
four overlapping mechanisms with one.

---

## The problem it solves

Before this spec, "what does a tier get?" was answered in four places that did not agree:

| Where | What it governed |
|---|---|
| `PLAN_FEATURES` in `lib/business-data.ts` | The billing screen's feature checklist — 7 rows |
| `FEATURE_MIN_TIER` in `lib/listing-tiers.ts` | Public listing richness — 14 features |
| `LISTING_LADDER` in `app/business/page.tsx` | Prose copy on the public plans page |
| `tierMeets()` calls on 9 manage pages | Actual page access |

Plus a second, orthogonal axis: 11 add-on toggles, of which the "premium" five cost
£10/mo each after the first.

The observable failures:

- **Events and Jobs** could be fully managed on Free, but were Premium-gated on the
  public listing — a business could build a ticketed event that would never appear.
- **Analytics** was gated by neither tier nor page, only by a separately-sold add-on.
- **`PLAN_FEATURES`** — the customer-facing promise — never mentioned products,
  services, passes, orders or events, i.e. the biggest Premium unlocks.
- **Add-ons duplicated tier gates without enforcing anything.** Toggling `products`
  off did not close `/manage/products`; only tier did.
- **Three "free" standard add-ons** (offers, stamps, payments) sat behind Pro pages,
  which `AddonsManager` had to work around by locking them.

---

## The principle

> **The island's shared sections are free. Your own trading operation is paid.**

What's On and Work only work if they are full. An event listing has value to Shetland
even if no ticket sells; a job posting has value even if the work is voluntary. Gating
those protects subscription revenue we will not collect, while leaving the sections
that carry the whole product empty.

A product catalogue, by contrast, has value only to the seller. That is a shop, not
community information — and it is paid.

The fee model already agrees with this: the two things that are free either carry their
own transaction revenue (95p + 1.5% per ticket) or cost nothing to host (jobs).
Bookings, which stay paid, carry no transaction fee at all.

---

## The tiers

### Free — *"Be found"* · £0

Everything needed to be a proper local business page. Worth claiming on its own merits.

- Full listing: name, category, area, logo, **cover photo**, **description**, opening
  hours, **phone, email and website**, **map pin**
- Verified badge, claim link
- **Jobs & shifts** — post roles, take applications
- **Events & ticketing** — 95p + 1.5% per ticket
- Basic view counts

> Cover photo, description and extra contacts move **down** from Pro. This is the point
> of the whole rewrite: 527 of 529 listed businesses are unclaimed, and the current
> pitch is "claim the page we built you, then pay £19.99 to say what you do." For a
> business whose only web presence is a Facebook page, that put the entire product
> behind the paywall.

### Pro — *"Turn finders into regulars"* · £12/mo

The counter tools. For any business with repeat custom.

- Everything in Free
- Offers
- Loyalty stamps & points, the till, NFC tap-to-stamp
- Local Wallet payments & cashback
- Enquiries
- Photo gallery
- **Analytics** (absorbed from the separately-sold add-on)
- **Bookings, metered** — see [Metered bookings](#metered-bookings-phase-2)

> Analytics moves in rather than being sold separately: charging a business extra to see
> its own customer numbers cuts against "community-first, not extractive."

### Premium — *"Sell as much as you like"* · £29/mo

- Everything in Pro
- Products & orders (5% per sale)
- Services
- Bookings & schedule, **unmetered**
- Passes & packs
- Membership
- Featured homepage spot

---

## Pricing

| Tier | Was | Now |
|---|---|---|
| Free | £0 | £0 |
| Pro | £19.99/mo | **£12/mo** |
| Premium | £49.99/mo | **£29/mo** |

£49.99/mo is £600/year from a Shetland café whose honest alternative is a free Facebook
page. In a market of ~23,000 people the constraint is adoption, not margin — and the old
pricing sat awkwardly beside the "tiny fees, 95p, not grabby percentages" positioning.

**There is no migration cost whatsoever.** Measured 16 Aug 2026: 528 businesses on Free,
0 on Pro, 1 on Premium (the `DEMO — Shetland Makkers` seed), and **zero live Stripe
subscriptions**. Nobody is paying anything. Only five add-ons are enabled anywhere, all
of them from the free "standard" set, all on the demo business.

This is the cheapest moment this change will ever be, and it is not close.

---

## Add-ons are abolished

All 11 add-on keys collapse into the tiers. Three become a different *kind* of thing:

| Was an add-on | Becomes | Why |
|---|---|---|
| NFC tile | A **one-off hardware purchase** | It is a physical object with a unit cost, not a monthly feature |
| Featured / Boost | A **one-off, time-limited buy** (`isOnBoost` already exists) | Prominence is episodic — you want it for Wool Week, not forever |
| Partner alerts | **Approval-gated, not sold** (`AlertAccess` flow already exists) | Island-wide emergency broadcast should not be purchasable |

There are **no recurring add-ons**. The "one premium add-on included, £10 each after"
rule disappears — today a Premium business wanting both bookings and products pays
£59.99; under this it is one price for everything.

---

## Metered bookings (phase 2)

Pro can take bookings at **95p per booking**. Premium includes them unmetered.

Why this exists: Shetland trade is seasonal. A 30-day Premium trial in February tells a
tour operator nothing, and by cruise season it has expired. Pay-per-booking lets a
business test in its own season, at its own pace. It also creates revenue on a rail that
currently has none — bookings take no payment at all today (`deposit_pence` is recorded
but never charged).

The arithmetic sells the upgrade without anyone having to be persuaded:

| Bookings/mo | Pro (£12 + 95p each) | Premium |
|---|---|---|
| 5 | £16.75 | £29 |
| 10 | £21.50 | £29 |
| **18** | **£29.10** ← crossover | £29 |
| 40 | £50.00 | £29 |

**Cap the metered fees at £17/mo** — the exact Pro→Premium gap. A Pro business can then
never pay more than Premium would have cost. On hitting the cap, the dashboard says
"you're busy enough that Premium is now cheaper — want to switch?"

That turns the meter from something that punishes success into "try it, and we won't let
you overpay while you find out." Given we are asking 527 sceptical businesses to trust a
new platform, that is worth more than the £17.

**Implementation note.** Most bookings take no deposit, so there is no transaction to
skim — this must be a **metered Stripe price on the Pro subscription**, with usage
reported per booking and the reported quantity capped at 17. Billing it as 18 separate
95p charges would lose ~21% of each to Stripe's fixed 20p.

This is the only genuinely new build in the spec; everything else is deletion. **The
tier rewrite ships without it** — Pro bookings arrive afterwards.

---

## Implementation

### One source of truth

A single `TIER_FEATURES` map in `lib/business-data.ts` replaces `PLAN_FEATURES`,
`FEATURE_MIN_TIER` and `LISTING_LADDER`. Sketch:

```ts
export type Feature =
  // Listing
  | "listing" | "coverPhoto" | "description" | "extraContacts" | "mapPin" | "gallery"
  | "featuredBadge"
  // Community sections — free, they populate What's On and Work
  | "jobs" | "events" | "tickets"
  // Counter
  | "offers" | "loyalty" | "till" | "nfc" | "wallet" | "enquiries" | "analytics"
  // Trading
  | "products" | "orders" | "services" | "bookings" | "schedule" | "passes"
  | "membership";

export const TIER_FEATURES: Record<Feature, SubscriptionTier> = {
  listing: "free", coverPhoto: "free", description: "free", extraContacts: "free",
  mapPin: "free", jobs: "free", events: "free", tickets: "free",

  gallery: "pro", offers: "pro", loyalty: "pro", till: "pro", nfc: "pro",
  wallet: "pro", enquiries: "pro", analytics: "pro",

  products: "premium", orders: "premium", services: "premium", bookings: "premium",
  schedule: "premium", passes: "premium", membership: "premium",
  featuredBadge: "premium",
};
```

Everything derives from this one map, so the four definitions can no longer disagree:

- **Page gates** — `tierMeets(business.subscription_tier, TIER_FEATURES[feature])`
- **Listing richness** — `tierUnlocks()` reads it instead of `FEATURE_MIN_TIER`
- **Billing checklist** — generated, not hand-listed
- **Plans page copy** — generated per tier

`lib/listing-tiers.ts` is mirrored byte-for-byte in `oneshetland-delivers/lib/`. Keep
both in step; there is no shared package.

### The public "For Business" page — `app/business/page.tsx`

This is the most visible artefact of the old model: it is live, public, and currently
advertises £19.99/£49.99 and an add-on shop that is being abolished. It needs more than
a price edit.

| What | Change |
|---|---|
| `TIER_PRICE` (lines 190, 306) | £19.99 → £12, £49.99 → £29 |
| `LISTING_LADDER` (line 28) | Delete — the per-tier prose derives from `TIER_FEATURES` |
| `includedThrough()` / `PLAN_FEATURES` (lines 144-146, 315) | Derive the checklist from `TIER_FEATURES` so it can no longer under-describe Premium |
| **The entire "Add-ons" section** (lines ~347-373) | **Delete.** "Premium includes your first premium add-on. Each extra is £10/mo" describes a model that no longer exists |
| `AddonCard` component (line 503) | Delete with the section |
| `EXTRA_ADDON_PRICE` (line 25) | Delete |
| SHOWCASE — "In-app bookings" (line 85) | Now Pro-metered / Premium-unmetered, not simply Premium |
| SHOWCASE — "Events & tickets" (line 99) | Now **free** — say so; this is a headline selling point |
| SHOWCASE — "Analytics dashboard" (line 120) | Now Pro, not a separately-sold add-on |

Consider replacing the deleted Add-ons section with a short **"One-off extras"** block
covering the NFC tile (hardware) and Boost (time-limited prominence) — the two things
that survive as purchases rather than subscriptions. See [open question 5](#open-questions).

### To delete

- `AddonKey`, `ADDON_META`, `PREMIUM_ADDON_KEYS`, `STANDARD_ADDON_KEYS`,
  `EXTRA_ADDON_MONTHLY_PENCE`, `countExtraPremiumAddons`
- `components/business/AddonsManager.tsx` and `/manage/addons`
- `supabase/functions/sync-business-addons`
- `business_addons` table (after checking nothing else reads it)
- The analytics add-on purchase path (`analytics-addon-intent`) — absorbed into Pro
- `PLAN_FEATURES`, `FEATURE_MIN_TIER`, `LISTING_LADDER`

### Stripe

New live Prices at £12 and £29 (the old £19.99/£49.99 test Prices are not reused).
Update `stripe.price.local_pro` and `stripe.price.local_premium` in `/admin/config`.
`stripe.price.local_addon` becomes unused. The metered booking Price is added in phase 2.

---

## Decisions taken (16 Aug 2026)

- **Enquiries → Pro.**
- **Photo gallery → metered by count. 3 photos on Free** (on top of the free cover
  photo), unlimited on Pro.
- **Products → stay Premium.**
- **`membership` → dropped.** See [Business membership](#business-membership-dropped).
- **Partner alerts → approval-gated and free.** See [Partner alerts](#partner-alerts-free).
- **NFC tile → the thank-you for an annual Premium**, not a shop item. This introduces
  **annual billing, which does not exist today** — see [Annual Premium](#annual-premium-new).
- **Boost → contextual, not a page.** Surfaced wherever a business is looking at its own
  reach, rather than living in one section of the marketing site.

### Business membership (dropped)

A recurring paid membership sold *by a business* (gym, salon, subscription box). Dropped,
for four reasons:

1. **Passes & packs already cover the realistic cases.** A class pack, a day pass, a book
   of ten — bought once, used later. The only thing membership adds is auto-renewal.
2. **The organisations that actually want memberships are Hubs**, which already have them,
   with Gift Aid on top. Shetland's membership bodies are clubs and charities, not shops.
3. **It is the most expensive thing in the stack to build well** — recurring billing on
   behalf of a third party via Connect, with failed payments, dunning, cancellation,
   proration and disputes. That is a permanent support burden, not a feature.
4. **Nobody has asked.** Zero businesses use it.

Revisit only when a real business asks for it, and design against that business.

### Partner alerts (free)

What it is: a business pushes an urgent message — the code's own examples are *"ferry
updates, road closures, event changes"* — which appears on the OneShetland homepage to
every user. Three severities: emergency, disruption, info. Today it needs both admin
approval **and** a £10/month add-on.

Who it is for: ferry operators, the council, Lerwick Port Authority, large employers.
Not a café.

**The approval gate is the real control; the £10 is not.** Charging an organisation to
warn the island that a ferry is cancelled is a bad look, and the revenue from the handful
who would ever qualify is negligible. Keep approval, drop the charge.

Consequence: delete `supabase/functions/alert-addon-intent`, and remove "and a £10/month
add-on" from `components/business/AlertsManager.tsx`.

### Annual Premium (new)

Sending a physical NFC tile to annual Premium businesses requires an **annual plan, which
does not currently exist** — every tier is monthly-only. This needs:

- A price (suggested: **£290/year** — twelve months for the price of ten)
- A new Stripe recurring Price, and `stripe.price.local_premium_annual` in `/admin/config`
- Tier logic that treats annual and monthly Premium identically for access, and differs
  only in billing period and NFC eligibility
- A fulfilment step: somewhere to see who is owed a tile and mark it sent

The commercial logic is sound — an annual commitment is exactly what justifies posting
someone hardware. But it is **new scope**, not part of the tier collapse, and should be
its own phase.

### Ticket payout timing (agreed)

Free ticketing means an unsubscribed business can take real money. The fee is not the
issue (95p + 1.5% is honest). The exposure is that **we are the merchant of record** on
destination charges, so chargebacks land on the platform's Stripe account along with a
dispute fee of roughly £20 each — on an £8 ticket where we collected £1.07.

This is smaller than it first looks, because selling tickets already requires Stripe
Connect onboarding, and Stripe performs identity verification as part of that. An
anonymous actor cannot quietly start selling.

The residual risk is a *legitimate* business taking ticket money for an event months out,
being paid immediately, and then cancelling or folding — leaving us to refund buyers from
platform funds and chase the business.

**Agreed: hold organiser payout until after the event date** (the standard approach — it
is what Eventbrite does). That addresses the real risk and needs no tier-based
restriction, so free ticketing ships as specified.

This is its own build, separate from the tier collapse: the ticket rail currently uses a
destination charge that transfers on payment, so it needs to become a
`transfer_data`-less charge plus a scheduled transfer after the event date, with a
reversal path when an event is cancelled.

---

## Build order

1. **Tier collapse** — `TIER_FEATURES`, page gates, listing richness, the For Business
   page, delete the add-on system. No new Stripe work beyond two new Prices.
2. **Ticket payout hold** — independent of tiers, wanted before real money.
3. **Annual Premium** — new Price, annual billing, NFC fulfilment view.
4. **Metered Pro bookings** — metered Stripe price, usage reporting, £17 cap, upgrade nudge.

---

## Related

- `lib/business-data.ts` — tier definitions and helpers
- `lib/listing-tiers.ts` — listing richness (mirrored in the app repo)
- `supabase/functions/create-event-ticket-intent` — the 95p + 1.5% ticket fee
- `supabase/functions/_shared/commission.ts` — the shared fee calculator
