# Planner context — telling the planner what a place actually is

**Status:** design, not built. Written 8 Aug 2026 after the planner offered a
flooring merchant and a shop called "Shoes" for a history-and-shops walk.

## The problem

The planner knows a place's name, category, coordinates and sometimes its
opening hours. From that it has to answer questions it has no business
answering:

- **Is this somewhere a visitor would go at all?** A flooring merchant and a
  knitwear shop are both `retail`. Jarlshof and a village hall are both
  `tourism`. Nothing distinguishes them.
- **How long do people spend?** Currently a guess by category — 30 minutes for
  any shop, 75 for anything tourism. Jarlshof gets the same 75 minutes as a
  roadside viewpoint. Every arrival time after the first stop inherits that
  error.
- **Does the weather matter?** Half of Shetland's attractions are outdoors and
  the planner cannot tell which.
- **Why is it worth a stop?** Peerie Bot is given a name, a category and
  whatever marketing description exists. It reasons well from that, and it
  would reason far better from one honest line about what the place is for.

Guessing these is why the plans are sometimes odd. No amount of prompt tuning
fixes missing data.

## What we'd ask for

Structured fields do the work; free text is one short line. That ordering is
deliberate — asked for a paragraph, every business writes marketing, and
marketing is exactly what a planner cannot reason over.

### From business owners (on their profile page)

| Field | Type | Why the planner needs it |
|---|---|---|
| `planner_visitor_ready` | boolean, **default false** | Opt IN. A trade counter says no and stops appearing. Solves the flooring merchant directly. |
| `planner_dwell_minutes` | int | Replaces the category guess. "About how long do folk spend?" — 15, 30, 45, 60, 90, half a day. |
| `planner_setting` | `indoor` / `outdoor` / `both` | Lets a wet day reshuffle the plan. |
| `planner_good_for` | text[] | Chips: families, a wet day, a quick stop, a proper visit, rainy-day bolthole, dogs welcome. |
| `planner_booking` | `none` / `advised` / `required` | "Turn up" vs "book ahead" changes whether it can be slotted in at all. |
| `planner_note` | text, **140 char limit** | One line, plainly worded: what someone actually does here. The limit is the point. |

### For seeded places (brochs, lighthouses, viewpoints)

Nobody owns these, so we set them — and by `kind` we can do it well without
touching each one:

| kind | dwell | setting | booking | good for |
|---|---|---|---|---|
| Broch / archaeological site | 30 | outdoor | none | a proper visit |
| Lighthouse | 25 | outdoor | none | a quick stop |
| Viewpoint | 15 | outdoor | none | a quick stop |
| Museum | 60 | indoor | none | a wet day, families |
| Castle or ruin | 35 | outdoor | none | a proper visit |
| Nature reserve | 90 | outdoor | none | a proper visit |
| Community hall | — | — | — | **not visitor-ready** |

That last row matters: it removes the halls and the library from visitor plans
without deleting anything, because they're genuinely useful in the Directory.

## What it changes in the planner

1. **`dwellMinutes()` uses the real figure** where there is one, falling back to
   the category guess. Every downstream arrival time gets more accurate.
2. **Candidate filtering respects `planner_visitor_ready`** — the strongest
   single quality lever available, and it costs an owner one tick.
3. **Weather-aware ordering.** Shetland Today already knows the forecast. On a
   wet day, indoor stops rise and outdoor ones fall. This is the feature a
   visitor would actually tell somebody about.
4. **Peerie Bot gets the note and the chips** in its candidate list, so its
   reasoning comes from what a place IS rather than what its category implies.

## Guarding against waffle

Everyone will claim to be perfect for everyone. So:

- The note is capped at 140 characters and the field label says plainly what it
  is for: *"One line on what a visitor actually does here. Not an advert — this
  is read by the day planner, and it works better with plain facts."*
- `good_for` is a fixed chip list, not free text. Chips can be reasoned over;
  adjectives cannot.
- Peerie Bot's system prompt already forbids claiming anything beyond what a
  candidate says. That rule extends to these fields — they're the owner's
  claims, not verified facts, and the scheduler still validates every time.

## Why this is worth doing before more data

More listings without this makes plans *worse*, not better — 130 brochs added
today already widened the pool the planner has to guess about. Context is the
multiplier on everything already imported.

It also gives the claim flow a genuine reason to exist for the owner: claim
your listing, tick three boxes, appear in visitors' plans. That's a far better
pitch than "keep your address up to date".

## Rollout

1. Migration: the six columns, all nullable, `planner_visitor_ready` default
   false.
2. Backfill the seeded places from the table above — one script run, no human.
3. Owner UI in the business profile page, under the opening hours.
4. Planner reads them; weather-aware ordering last, since it needs the forecast
   wired in.

Steps 1–2 alone would materially improve plans without a single business doing
anything.
