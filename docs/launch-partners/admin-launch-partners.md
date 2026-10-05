# Admin → Launch partners (foundation)

Status: built and tested locally. **Not deployed. The migration is not applied to production. No invitation issued, no email sent, no public page changed.**

## What it is
`/admin/launch-partners` is an operational pipeline for launch-partner acquisition: pick an existing Directory business, prepare a private Launch Preview and a private Business Page V2 draft, review, generate a private invitation, and follow it through viewed → claim → Premium → setup → (later) live.

## Data model — `supabase/migrations/20261106000000_launch_partner_campaigns.sql` (mobile/DB repo)
* `launch_partner_campaigns` — one row per business (unique). Stores only what exists nowhere else: `slug`, editorial `stage` (candidate / preparing / ready_to_invite / sent / archived), `positioning`, `preview_config` (JSONB — the Launch Preview), `page_config` (JSONB — the Business Page V2 draft), outreach contact + email draft, `sent_at`, `first_viewed_at` / `last_viewed_at` / `view_count`, and two RESERVED timestamps `setup_ready_at`, `live_at` that nothing in this version sets.
* `launch_partner_events` — audit trail (kind, actor, changed field names only; never tokens or email text).
* Both tables: RLS on, no policies, no grants to any client role. Reachable only through SECURITY DEFINER functions.
* **Status is derived**, not stored: invitation (`launch_invites`), claim (`business_claims`), grant (`launch_plan_grants`) and products come from their own tables — `lib/launch-partners/status.ts`.
* Admin gate = the existing `launch_plan_authorised()`. Public/anon can only call `launch_invite_record_view` and `launch_invite_preview_config`, both of which need a valid invitation token for that slug.

## Web
* `lib/launch-partners/` — status, email, validation, draft builders (pure, node-tested) and `campaigns.server.ts` (the only module that talks to the campaign functions; no service role, no direct table access, no writes to any listing).
* `app/admin/launch-partners/` — pipeline, editor (Business · Positioning · Preview · Business page · Invitation · Email · Status) and `actions.ts` (every action begins with `requireAdmin()`).
* `app/admin-preview/launch-partners/[id]/{launch,business-page}` — admin-only full-bleed review of each draft (outside the admin shell so it looks like the real thing). noindex, no-referrer, no-store.
* `app/business/[id]/manage/page-draft` — the owner's own look at their prepared page, **only** after an approved launch-partner claim (checked in the database; otherwise a plain 404).
* `/launch/{slug}` now reads its content from the stored campaign (token-checked in the database), falling back to the code config for anything not yet brought into Admin.

## Business Page V2
`lib/business-page/` (model, tokens, `planSections`) + `components/business-page/BusinessPageV2.tsx` + shared pieces in `components/design-v2/` (also used by the Launch Preview: `Img`, `Section`, `ProductTile`, `MediaCard`, `ReserveCard`).

Adaptive rules (`planSections`): a section appears only if the business has content for it; hero first; hours → location → contact always last; the middle follows the **emphasis** — `story_then_shop` (story, shop, experience, …), `shop_first`, `book_first` (book, about, offers, rewards …), `experience_first` — chosen in Admin or inferred (booking and no shop → book first; shop → shop first; …). An explicit `layout` overrides the middle order. **Real content always replaces examples**; examples are labelled "Example" and never linked or purchasable.

Not yet in V2 (deliberately): the interactive widgets of the current listing (follow, claim an offer, slot picker, wallet top-up). V2 links to the existing flows (`/product/{id}`, `/directory/{id}?book=…`). The public `/directory/{id}` route is untouched.

## Three states, and the promotion path (designed; the last step is not built)

1. **Current public listing** — today's `/directory/{id}`. Untouched by everything here.
2. **Prepared business page** — Darren's rich private Business Page V2 (`page_config`). May contain example commerce. Private to Admin and, after an approved launch-partner claim, to that owner.
3. **Approved future live page** — after the owner claims, reviews and edits their profile, imports/adds real commerce, and explicitly presses Go live, the **approved profile** becomes the basis of the real Business Page V2. It is *not* rebuilt from the sparse Directory record.

```
prepared draft ──(Darren)──▶ 'prepared' version
      │
      ▼  owner reviews / edits                       ── 'owner_edit' versions (each points at what it came from)
      │
      ▼  owner approves                              ── 'approved' version  (+ approved_at / approved_by on the campaign)
      │
      ▼  owner presses Go live   [NOT BUILT]         ── 'published' version (+ published_version_id, live_at)
public V2 page = approved PROFILE  +  REAL commerce
```

### Profile vs commerce
| Moves forward (profile) | Never moves forward automatically (commerce) |
|---|---|
| hero headline, tagline, label, place, picture, treatment, gallery pictures | example products (and their prices/titles) |
| business story, "useful information" blocks | example experience, booking illustration |
| which strength leads (emphasis) and section order | suggested rewards/offers |
| contact / location presentation (via the Directory fields the owner confirms) | internal notes |

Real products, services, offers, passes and reward programmes appear on a live page only because they genuinely exist in OneShetland — import or "Add manually" populates the Shop automatically; a draft can never create one. Enforced in three places that must agree: `lib/business-page/profile.ts` (+ `enforceLive`), the database whitelist (`_launch_partner_profile_extract` and the table CHECK), and tests on both.

### Audit trail — `launch_partner_page_versions` (migration `20261107000000_launch_partner_profile_versions.sql`, mobile/DB repo)
Append-only (UPDATE/DELETE/TRUNCATE refused). Each row: campaign, business, `kind` (`prepared` | `owner_edit` | `approved` | `published`), the **profile** only, `parent_id` (what it derived from), actor and role, time.
* *What Darren prepared* → `prepared` rows (`admin_launch_partner_record_prepared`).
* *What the owner changed* → `owner_edit` rows with their parent (`launch_partner_owner_save_profile`; commerce keys refused by name).
* *What the owner approved and when* → `approved` rows + `approved_at/approved_by` (`launch_partner_owner_approve`; approving publishes nothing).
* *What was eventually published* → `published` row + `published_version_id` — **reserved; nothing writes it yet**.
Readers: `launch_partner_profile_versions` (history, no bodies), `launch_partner_version_profile`, `launch_partner_approved_profile` — admin or the approved owner only.

### Go live (contract only)
`launch_partner_owner_go_live(p_business_id, p_version_id)`: the single explicit, reversible owner action. Preconditions: approved launch claim, terms accepted, a live plan/grant, and an approved version. Effects: insert a `published` version, set `published_version_id` and `live_at`, and flip a new `local_businesses.page_version` ('v1' → 'v2') that the public route reads; real commerce is published only through the existing owner-session publish route, item by item. An un-publish mirrors it. Needs the public-page switch, which does not exist yet.

### Admin review
`/admin-preview/launch-partners/{id}/business-page` (Prepared) and `…?view=future-live` (**Future live preview · Not public**): the same design with the profile layer only and real commerce inserted; empty commerce sections show a dashed *review note* saying where real content will appear (never part of what customers see). The owner's own page (`/business/{id}/manage/page-draft`) has the same two views. There is deliberately no "live from today's sparse Directory fields" view.

## View tracking
A valid private preview opening sets `first_viewed_at`, and `last_viewed_at`/`view_count` at most once per 30 minutes. Not recorded for admins or local review tokens; the token goes only to the database; a view implies nothing about claiming or consent. Caveat: an email security scanner that opens links can register as a view.

## Email
Prepared and stored (contact, subject, body with `{{INVITATION_LINK}}` placeholder, preview, copy). **Sending is not implemented.** A draft containing a real invitation link is refused. Darren sends it himself and records it ("I've sent it myself"), which requires a live invitation.

## Invitations
`Generate private invitation` calls the existing `admin_issue_launch_invite` (hash stored, token shown once, never saved). Real campaigns must be "Ready to invite" first; a test fixture may be issued any time. The claim button on the preview stays **closed (holding)** until an admin opens it, and only while an invitation is live; the claim action itself enforces this.

## Before this can ship (Darren's decisions)
1. Apply `20261106000000_launch_partner_campaigns.sql` (prerequisites: launch_partner_claims, launch_plan_grants, product_import_foundation — all already live).
2. Deploy web; open Admin → Launch partners → "Bring in the existing previews" (creates six private drafts; idempotent).
3. Nothing is invited or sent by either step.
