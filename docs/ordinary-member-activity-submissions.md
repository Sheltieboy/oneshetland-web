# What it would take: Regular Activity submissions from ordinary members

Status: analysis only. Nothing here is built. Written 7 Nov 2026 from the real schema and code
(migrations `20261208000000_regular_activities.sql`, `20261208010000_activity_notifications.sql`,
`20261209000000_activity_messages.sql`, `20261230010000_event_member_submissions.sql`, and the web
editors under `app/business/[id]/manage/activities` and `app/hubs/[id]/manage/activities`).

## Today (the rule the product follows now)

A Regular Activity is owned by exactly one Business or one Hub. A member with neither cannot create one, and the
"Add an Event or Activity" front door says so plainly and offers "Start a free hub" and "Add your business". That is
deliberate, and it is what the database enforces, not just the screens.

Why ownership matters: almost every behaviour of an activity keys off its owner.

| Behaviour | Where it lives | Keyed on |
|---|---|---|
| Who may edit, cancel, add sessions, set breaks | `can_manage_activity()` -> `controls_event_entity(business, hub)` | owner business's `owner_id`, or hub owner/committee (`is_hub_admin`) |
| Row security on activities, rules, exceptions, breaks | `ra_read_manage`, `ra_insert`, `ra_update`, `*_write` policies | `can_manage_activity` |
| Ownership shape | CHECK `ra_owner_exclusive` | platform XOR exactly one of business/hub |
| Public visibility | `activity_is_public()`, `ra_read_public` | status published, not paused, owner active; a hub's activities also need `calendar_approved` (hub verified or staff-approved) |
| Messages to followers and their limits | `send_activity_message()` | per activity (1/hour, 3/day) and per organiser (10/day), advisory lock per organiser |
| Follower alerts on schedule changes | outbox + `activity_notice_state` + scheduled SQL job | per activity |
| Staff hand-over | `admin_assign_activity_owner()` | writes `activity_owner_log` |
| "Run by" label | `lib/activity-organiser.ts` | owner kind and name; platform owner = no claim |

## What would be required

### 1. Schema

An independent activity has no owner row, so the cleanest design is NOT to loosen `ra_owner_exclusive` (it is the
guard that stops an activity ever having two owners or none), but to copy the event pattern: a private
**`activity_submissions`** table, plus approval that creates a **platform-owned** activity (`is_platform_activity = true`,
no business, no hub), exactly as `event_submissions` creates a platform-owned event.

- `activity_submissions`: submitter_id, status (pending/approved/rejected/changes_requested/withdrawn), organiser_name
  (the public credit), title, description, category (the ten activity slugs), audience, venue, locality, price_text,
  booking_mode and contact/booking URL, the weekly schedule as validated rule rows (day, start, end, season dates),
  adult_confirmed, review fields, `activity_id` once approved, request_id for idempotency.
- New columns on `regular_activities`: `source` (`'community_submission'`), `organiser_name`, and `managed_by_user_id`
  (the person who may look after it after approval). The ownership CHECK stays as it is: the activity is
  platform-owned, which the CHECK already allows.
- Implication: today `can_manage_activity` explicitly returns staff-only for platform activities. A person-managed
  activity needs a third branch (`managed_by_user_id = auth.uid()` for source = community_submission), added to
  `can_manage_activity`, `ra_read_manage` and the child-table `*_write` policies, and to the `tg_ra_guard` trigger
  so the person can change content but never owner, platform flag, slug, approval or pause state.
- Account deletion: `managed_by_user_id` must be `on delete set null`, and an unmanaged community activity needs a
  defined outcome (staff review, then end or reassign).

### 2. Moderation

Mirror events: private submission row, staff queue (`admin_list_activity_submissions`, `admin_review_activity_submission`),
approve / ask for changes / reject with a reason, a master switch in `admin_config` that defaults to closed, staff can
submit while it is closed for acceptance testing. Approval creates the activity and its schedule rules in one
transaction. Because a weekly activity runs indefinitely, moderation has to cover more than an event: a first approval is
not an approval of every future edit (see 3).

### 3. Contributor self-service

Sessions, cancellations, extra sessions and holiday breaks are the whole point of an activity, and today they write
straight through `can_manage_activity`. A person-managed activity would need an explicit decision, per action:

- Cancel a session, restore it, set a break: low risk, and time-critical, so allow directly (as event cancellations are).
- Change time, venue or add an extra session: allow directly for an approved, trusted contributor; send to a look-first
  route otherwise (the events change-request flow, `ALWAYS_LOOKED_AT` fields, is the model).
- Change title, description, cover image, price, or contact details: always look first, as events do for name, poster and price.
- End the activity: allow.
This needs a change-request table for activities (events already have one) and a "My activities" screen (events have "My submissions").

### 4. Follower messaging and rate limits

`send_activity_message()` counts limits on the activity and on the organiser, "never on the person, so a second manager
cannot start a second allowance". For a person-managed activity the "organiser" bucket is the platform (a platform-owned
activity's organiser is "OneShetland itself"), so ALL community activities would share one 10-messages-a-day allowance.
That is wrong for scale and unfair between contributors. It needs a new bucket: per managing person (and per activity),
with the platform bucket removed for source = community_submission. Also needed: messages stay plain text, no links,
phones or emails (already enforced), staff can hide (already built), and a contributor who is suspended loses the ability
to send. Messages must be credited to the organiser name, never to OneShetland.

### 5. Attribution

Rule already held for events: a community submission is credited to `organiser_name`, NEVER "OneShetland". For activities
the same change is needed in `regular_activities_listing()` (it currently returns `coalesce(hub.name, business.name,
'OneShetland')` as `owner_name`; for a community activity it must return the organiser name, with an owner kind that the UI
reads as "community group", not "platform"), and `lib/activity-organiser.ts` must learn the new kind. Today a platform-owned
activity shows no organiser claim at all; a community one must show the name the contributor gave, labelled as given by them.

### 6. Social, the weekly roundup and notifications

- The Social regular-activities roundup and recipes read public activities. Community activities should be eligible only
  after approval, and the roundup copy must credit the organiser name. Any recipe that groups by owner needs the new kind.
- Schedule-change alerts to followers (the scheduled SQL job) key on the activity, so they would work unchanged once the
  activity exists. Messages and alerts go to the Notification Centre only (no push, no email): copy must keep saying so.
- The submitter's own "decided" status is not notified today for events either; keep it that way and say so on screen.

### 7. Mobile

The app reads activities through `regular_activities_listing` and `activity_sessions`; a new owner kind needs the app to
treat it as "named group, no hub or business link". The app has no contributor screens, so a person managing an activity
would manage it on the web only until the app ships a "My activities" screen. A JS-only OTA cannot add database
behaviour; the schema and RPCs must be live first and every new field must be optional to the installed builds.

### 8. Safety and abuse limits

Reuse the event limits as a starting point (3 waiting, 10 per 24 hours, a global ceiling), plus: a cap on the number of
live community activities per person (suggest 5), a cap on sessions per week, ban on links and contact details in free
text with the separate contact box, adult confirmation, no images until the existing image checks are proven for this
path, a staff pause (`admin_set_activity_paused` already exists) and an audit log (`activity_owner_log` pattern). Children's
groups and faith/wellbeing groups carry safeguarding risk: for those categories a person-managed activity should require
staff approval on every material change, and a stated safeguarding contact, before launch.

### 9. Test plan

Database tests (the repo's isolated-Postgres harness): submission validation and limits; approval creates exactly one
platform-owned activity with the right credit; ownership CHECK untouched and still rejecting two owners; the new
`can_manage_activity` branch (the managing person yes; any other member no; former manager no); guard trigger blocks
owner/approval changes; RLS on rules/exceptions/breaks; message limits per person and no shared platform bucket; hidden
messages still count; listing function never returns "OneShetland" for community activities. Web tests: front-door state
machine (a member with neither may now reach an activity form only when the switch is on), copy tests (no promise of
notifications or instant publishing), link existence. Rendered checks at 1280 and 375 with axe and keyboard walk.
Regression: every existing business/hub activity test unchanged.

## Phased proposal

1. Decision and policy (no code): confirm moderation owner, categories allowed, safeguarding position, caps.
2. Schema and moderation behind a closed switch: `activity_submissions`, platform-owned approval, staff queue, listing
   attribution fix, tests. Staff-only submit.
3. Contributor submit form and "My activity submissions" (web), look-first changes and direct cancellations.
4. Person-managed permissions and per-person message limits; follower alerts verified end to end.
5. Social roundup eligibility and copy; mobile read support; open the switch to a small group, then everyone.

## Honest effort estimate

Roughly 3 to 5 weeks of careful work for one developer working with review: about a week for schema, approval and
RLS with the harness tests; a week for the staff queue and contributor screens; a week for change-requests and
person-managed permissions; a week for messaging limits, attribution, Social and mobile read changes; the remainder
for rendered verification, staged deploy and a supervised launch. The risk is not the form: it is the permission model
(a third kind of manager across five tables and two RPCs), moderation load for something that never ends, and safeguarding
for children's and faith groups. Given the product rule that hubs are free and cover the same need, the recommended path is
to keep Business-or-Hub ownership and make starting a hub easier first; build this only if real demand shows hubs are too
heavy for one-person weekly activities.
